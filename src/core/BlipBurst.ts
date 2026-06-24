import type {
  BlipBurstOptions, Fault, FaultSequence, Metrics, ProfileName, FailureProfile, RetryOptions, CircuitBreakerOptions
} from '../types.js';
import { SeededRandom } from './SeededRandom.js';
import { FaultInjector, BlipBurstError } from './FaultInjector.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import { RetryManager } from './RetryManager.js';
import { resolveProfile } from './FailureProfiles.js';
import { MetricsCollector } from '../observability/MetricsCollector.js';
import { Logger } from '../observability/Logger.js';
import { WebhookEmitter } from '../observability/WebhookEmitter.js';
import { OtelIntegration } from '../observability/OtelIntegration.js';
import { FaultRecorder } from '../scenario/FaultRecorder.js';
import { FaultReplayer } from '../scenario/FaultReplayer.js';

export class BlipBurst {
  // Legacy fields (unchanged — backward compat)
  private startDate: Date;
  private endDate: Date;
  private errorFrequency: number;
  private totalErrors: number;
  private errorsThrown = 0;
  private lastErrorTime = 0;
  private url: string;
  private fetchFunc: typeof fetch;

  // New fields
  private rng: SeededRandom;
  private faultInjector: FaultInjector;
  private circuitBreaker: CircuitBreaker;
  private retryManager: RetryManager;
  private metrics: MetricsCollector;
  private logger: Logger;
  private webhookEmitter: WebhookEmitter | null = null;
  private otel: OtelIntegration | null = null;
  private recorder: FaultRecorder | null = null;
  private replayer: FaultReplayer | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeFaults: Fault[];
  // exposed as non-private so static helpers can set it
  isNewMode: boolean;

  constructor(options: BlipBurstOptions = {}) {
    const now = new Date();

    // Legacy field init (unchanged)
    this.startDate = options.startDate ? new Date(options.startDate as string) : now;
    this.endDate = options.endDate
      ? new Date(options.endDate as string)
      : new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    this.errorFrequency = options.frequency ?? (1 / (24 * 60));
    this.totalErrors = options.total ?? 4;
    this.url = options.url ?? 'https://jsonplaceholder.typicode.com/posts/1';

    if (typeof window === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.fetchFunc = require('node-fetch');
    } else {
      this.fetchFunc = fetch.bind(window);
    }

    // New engine init
    this.rng = new SeededRandom(options.seed ?? (Date.now() ^ (Math.random() * 0xFFFFFFFF)));
    this.metrics = new MetricsCollector();
    this.logger = new Logger(options.logger);

    if (options.webhook) {
      this.webhookEmitter = new WebhookEmitter(options.webhook, this.fetchFunc);
    }
    if (options.otel) {
      this.otel = new OtelIntegration();
    }

    // Resolve profile (may override faults/retry/circuitBreaker)
    let resolvedFaults = options.faults ?? [];
    let resolvedRetry: RetryOptions = options.retry ?? {};
    let resolvedCb: CircuitBreakerOptions = options.circuitBreaker ?? {};

    if (options.profile) {
      const profile = resolveProfile(options.profile);
      resolvedFaults = options.faults ?? profile.faults;
      resolvedRetry = options.retry ?? profile.retry ?? {};
      resolvedCb = options.circuitBreaker ?? profile.circuitBreaker ?? {};
    }

    this.activeFaults = resolvedFaults;
    this.circuitBreaker = new CircuitBreaker(resolvedCb);
    this.faultInjector = new FaultInjector(this.rng);
    this.retryManager = new RetryManager(resolvedRetry, this.circuitBreaker, this.rng);

    // New mode: any new option was set
    this.isNewMode = !!(options.faults || options.profile || options.retry || options.circuitBreaker || options.otel || options.webhook || options.logger || options.seed !== undefined);
  }

  public async makeRequest(overrideUrl?: string): Promise<any> {
    if (!this.isNewMode) {
      return this._legacyMakeRequest();
    }
    return this._newMakeRequest(overrideUrl);
  }

  private async _legacyMakeRequest(): Promise<any> {
    if (!this.isInErrorWindow()) {
      return this.fetchFunc(this.url).then((res: any) => res.json());
    }
    if (this.errorFrequency === 0) {
      if (this.errorsThrown === 0) {
        this.errorsThrown++;
        throw new Error('Error from moon - all at once');
      }
      return this.fetchFunc(this.url).then((res: any) => res.json());
    }
    const now = Date.now();
    const interval = 60000 / this.errorFrequency;
    if (this.errorsThrown < this.totalErrors && now - this.lastErrorTime >= interval) {
      this.lastErrorTime = now;
      this.errorsThrown++;
      throw new Error('Error from mars - frequency mode');
    }
    return this.fetchFunc(this.url).then((res: any) => res.json());
  }

  private async _newMakeRequest(overrideUrl?: string): Promise<any> {
    const url = overrideUrl ?? this.url;
    const start = Date.now();
    let appliedFault: Fault | null = null;

    try {
      const result = await this.retryManager.execute(async () => {
        // Determine fault from replayer (if replaying) or injector
        let fault: Fault | null = null;
        if (this.replayer) {
          fault = this.replayer.next(this.recorder?.requestIndex ?? 0);
        } else if (this.activeFaults.length > 0) {
          fault = this.faultInjector.selectFault(this.activeFaults);
        }

        if (this.recorder) this.recorder.incrementIndex();

        if (fault) {
          appliedFault = fault;
          if (this.recorder) this.recorder.record(fault, url);
          this.logger.info('fault.injected', { kind: fault.kind, url });
          this.webhookEmitter?.emit({ timestamp: new Date().toISOString(), level: 'info', event: 'fault.injected', data: { kind: fault.kind, url } });

          const span = this.otel?.startSpan(`blipburst.fault.${fault.kind}`, { 'fault.kind': fault.kind, url });
          try {
            const response = await this.faultInjector.applyFault(fault, this.fetchFunc, url);
            if (!response.ok) {
              this.otel?.endSpan(span ?? null, new Error(`HTTP ${response.status}`));
              throw new BlipBurstError(`HTTP ${response.status}`, response.status, fault);
            }
            this.otel?.endSpan(span ?? null);
            return response.json();
          } catch (err) {
            this.otel?.endSpan(span ?? null, err instanceof Error ? err : new Error(String(err)));
            throw err;
          }
        }

        return this.fetchFunc(url).then((res: any) => res.json());
      });

      const duration = Date.now() - start;
      this.metrics.recordRequest(duration, appliedFault, true, this.retryManager.totalRetries);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      this.metrics.recordRequest(duration, appliedFault, false, this.retryManager.totalRetries);
      this.logger.warn('request.failed', { error: String(err), url });
      throw err;
    }
  }

  public async _injectAndFetch(url: string, init: RequestInit | undefined, originalFetch: typeof fetch): Promise<Response> {
    const fault = this.activeFaults.length > 0 ? this.faultInjector.selectFault(this.activeFaults) : null;
    if (!fault) return originalFetch(url, init);

    this.logger.info('fault.injected', { kind: fault.kind, url });
    this.webhookEmitter?.emit({ timestamp: new Date().toISOString(), level: 'info', event: 'fault.injected', data: { kind: fault.kind, url } });
    return this.faultInjector.applyFault(fault, originalFetch, url, init);
  }

  getMetrics(): Metrics {
    return this.metrics.getMetrics(this.circuitBreaker.getState());
  }

  resetMetrics(): void {
    this.metrics.reset();
    this.circuitBreaker.reset();
  }

  startRecording(): void {
    this.recorder = new FaultRecorder();
    this.recorder.startRecording();
  }

  stopRecording(): FaultSequence {
    if (!this.recorder) throw new Error('Not currently recording');
    return this.recorder.stopRecording();
  }

  runScenario(profile: ProfileName | FailureProfile): void {
    const resolved = resolveProfile(profile);
    this.activeFaults = resolved.faults;
    this.isNewMode = true;
    if (resolved.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(resolved.circuitBreaker);
    }
    if (resolved.retry) {
      this.retryManager = new RetryManager(resolved.retry, this.circuitBreaker, this.rng);
    }
  }

  static interceptFetch(options: BlipBurstOptions): () => void {
    const captured = globalThis.fetch;
    const instance = new BlipBurst({ ...options });
    instance.isNewMode = true;

    globalThis.fetch = async function blipBurstFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      return instance._injectAndFetch(url, init, captured);
    };

    return () => { globalThis.fetch = captured; };
  }

  static interceptAxios(axiosInstance: any, options: BlipBurstOptions): () => void {
    const instance = new BlipBurst({ ...options });
    instance.isNewMode = true;

    const reqId = axiosInstance.interceptors.request.use(async (config: any) => {
      const fault = instance.activeFaults.length > 0 ? instance.faultInjector.selectFault(instance.activeFaults) : null;
      if (fault && (fault.kind === 'latency' || fault.kind === 'timeout' || fault.kind === 'reset')) {
        await instance.faultInjector.applyFault(fault, instance.fetchFunc, config.url ?? '');
      }
      return config;
    });

    const resId = axiosInstance.interceptors.response.use(
      (response: any) => response,
      (error: any) => Promise.reject(error),
    );

    return () => {
      axiosInstance.interceptors.request.eject(reqId);
      axiosInstance.interceptors.response.eject(resId);
    };
  }

  static interceptAngular(httpBackend: any, options: BlipBurstOptions): () => void {
    const instance = new BlipBurst({ ...options });
    instance.isNewMode = true;
    const originalHandle = httpBackend.handle.bind(httpBackend);

    httpBackend.handle = (request: any) => {
      const fault = instance.activeFaults.length > 0 ? instance.faultInjector.selectFault(instance.activeFaults) : null;
      if (!fault) return originalHandle(request);
      // Return observable that applies fault then delegates
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { from } = require('rxjs');
      return from(instance.faultInjector.applyFault(fault, instance.fetchFunc, request.url).then(() => originalHandle(request)));
    };

    return () => { httpBackend.handle = originalHandle; };
  }

  static replay(sequence: FaultSequence): BlipBurst {
    const instance = new BlipBurst({});
    instance.isNewMode = true;
    instance.replayer = new FaultReplayer(sequence);
    return instance;
  }

  private isInErrorWindow(): boolean {
    const now = new Date();
    return now >= this.startDate && now <= this.endDate;
  }
}
