import type { CircuitState, Fault, LatencyStats, Metrics } from '../types.js';

export class MetricsCollector {
  private latencySamples: number[] = [];
  private faultCounts: Map<string, number> = new Map();
  private _successCount = 0;
  private _failureCount = 0;
  private _retryCount = 0;

  recordRequest(durationMs: number, fault: Fault | null, success: boolean, retries = 0): void {
    // insertion sort to keep array sorted
    let i = this.latencySamples.length;
    this.latencySamples.push(durationMs);
    while (i > 0 && this.latencySamples[i - 1]! > durationMs) {
      this.latencySamples[i] = this.latencySamples[i - 1]!;
      i--;
    }
    this.latencySamples[i] = durationMs;

    if (fault) {
      this.faultCounts.set(fault.kind, (this.faultCounts.get(fault.kind) ?? 0) + 1);
    }
    if (success) this._successCount++; else this._failureCount++;
    this._retryCount += retries;
  }

  getMetrics(circuitBreakerState: CircuitState): Metrics {
    return {
      totalRequests: this._successCount + this._failureCount,
      successCount: this._successCount,
      failureCount: this._failureCount,
      retryCount: this._retryCount,
      latency: this.computeLatency(),
      circuitBreakerState,
      faultStats: Object.fromEntries(this.faultCounts),
    };
  }

  reset(): void {
    this.latencySamples = [];
    this.faultCounts.clear();
    this._successCount = 0;
    this._failureCount = 0;
    this._retryCount = 0;
  }

  private computeLatency(): LatencyStats {
    const s = this.latencySamples;
    if (s.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    return {
      p50: this.percentile(s, 0.5),
      p95: this.percentile(s, 0.95),
      p99: this.percentile(s, 0.99),
      min: s[0]!,
      max: s[s.length - 1]!,
    };
  }

  private percentile(sorted: number[], p: number): number {
    const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
    return sorted[idx]!;
  }
}
