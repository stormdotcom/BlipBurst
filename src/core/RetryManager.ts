import type { RetryOptions } from '../types.js';
import type { CircuitBreaker } from './CircuitBreaker.js';
import type { SeededRandom } from './SeededRandom.js';
import { BlipBurstError } from './FaultInjector.js';

export class CircuitOpenError extends Error {
  constructor() { super('Circuit breaker is open'); this.name = 'CircuitOpenError'; }
}

export class RetryManager {
  private readonly opts: Required<RetryOptions>;
  private _retries = 0;

  constructor(
    options: RetryOptions = {},
    private circuitBreaker: CircuitBreaker,
    private rng: SeededRandom,
  ) {
    this.opts = {
      maxRetries: options.maxRetries ?? 0,
      backoff: options.backoff ?? 'fixed',
      initialDelay: options.initialDelay ?? 100,
      maxDelay: options.maxDelay ?? 30000,
      jitter: options.jitter ?? false,
      retryOn: options.retryOn ?? [500, 502, 503, 504],
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      if (this.circuitBreaker.isOpen()) throw new CircuitOpenError();

      try {
        const result = await operation();
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (err) {
        lastError = err;
        this.circuitBreaker.recordFailure();

        if (attempt < this.opts.maxRetries && this.shouldRetry(err)) {
          this._retries++;
          const delay = this.computeDelay(attempt);
          await new Promise<void>(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  get totalRetries(): number { return this._retries; }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof BlipBurstError && error.statusCode !== undefined) {
      return this.opts.retryOn.includes(error.statusCode);
    }
    // Network errors (AbortError, TypeError) are always retried
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'BlipBurstError')) return true;
    if (error instanceof TypeError) return true;
    return false;
  }

  private computeDelay(attempt: number): number {
    let delay: number;
    switch (this.opts.backoff) {
      case 'linear': delay = this.opts.initialDelay * (attempt + 1); break;
      case 'exponential': delay = Math.min(this.opts.initialDelay * Math.pow(2, attempt), this.opts.maxDelay); break;
      default: delay = this.opts.initialDelay;
    }
    if (this.opts.jitter) {
      const jitter = delay * 0.25;
      delay += this.rng.nextInt(-Math.floor(jitter), Math.floor(jitter));
    }
    return Math.max(0, Math.min(delay, this.opts.maxDelay));
  }
}
