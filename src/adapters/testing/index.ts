import { BlipBurst } from '../../core/BlipBurst.js';
import type { BlipBurstOptions } from '../../types.js';

export function withBlip<T>(
  options: BlipBurstOptions,
  testFn: (sim: BlipBurst) => Promise<T>,
): () => Promise<T> {
  return async () => {
    const sim = new BlipBurst(options);
    return testFn(sim);
  };
}

export function expectRetried(sim: BlipBurst, n: number): void {
  const metrics = sim.getMetrics();
  if (metrics.retryCount !== n) {
    throw new Error(`Expected ${n} retries but got ${metrics.retryCount}`);
  }
}
