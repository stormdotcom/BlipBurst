import type { Fault, CorruptionFault, HttpErrorFault, LatencyFault, ResetFault, TimeoutFault } from '../types.js';
import type { SeededRandom } from './SeededRandom.js';

export class BlipBurstError extends Error {
  constructor(message: string, public readonly statusCode?: number, public readonly fault?: Fault) {
    super(message);
    this.name = 'BlipBurstError';
  }
}

export class FaultInjector {
  constructor(private rng: SeededRandom) {}

  async applyFault(fault: Fault, fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
    switch (fault.kind) {
      case 'latency': return this.applyLatency(fault, fetchFn, url, init);
      case 'corruption': return this.applyCorruption(fault, fetchFn, url, init);
      case 'reset': return this.applyReset();
      case 'timeout': return this.applyTimeout(fault, fetchFn, url, init);
      case 'httpError': return this.applyHttpError(fault);
    }
  }

  private async applyLatency(fault: LatencyFault, fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
    const delay = this.rng.nextInt(fault.minMs, fault.maxMs);
    await new Promise<void>(resolve => setTimeout(resolve, delay));
    return fetchFn(url, init);
  }

  private async applyCorruption(fault: CorruptionFault, fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
    const strategy = fault.strategy ?? 'garbledJson';
    if (strategy === 'nullBody') return new Response(null, { status: 200 });
    if (strategy === 'garbledJson') return new Response('{bad:json###corrupt', { status: 200, headers: { 'Content-Type': 'application/json' } });
    // truncate: make real request, return first half of body
    const real = await fetchFn(url, init);
    const text = await real.text();
    return new Response(text.slice(0, Math.floor(text.length / 2)), { status: real.status, headers: real.headers });
  }

  private applyReset(): never {
    throw new BlipBurstError('Connection reset', undefined, { kind: 'reset' });
  }

  private async applyTimeout(fault: TimeoutFault, fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fault.afterMs);
    try {
      return await fetchFn(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private applyHttpError(fault: HttpErrorFault): Response {
    return new Response(fault.body ?? '', { status: fault.statusCode });
  }

  selectFault(faults: Fault[]): Fault | null {
    for (const fault of faults) {
      if (this.rng.chance(fault.probability ?? 1.0)) return fault;
    }
    return null;
  }
}
