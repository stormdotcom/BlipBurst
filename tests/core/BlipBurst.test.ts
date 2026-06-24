import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlipBurst } from '../../src/core/BlipBurst.js';

describe('BlipBurst - backward compatibility', () => {
  it('makeRequest() succeeds outside error window', async () => {
    const past = new Date(Date.now() - 10000);
    const alsoP = new Date(Date.now() - 5000);
    const sim = new BlipBurst({ startDate: past, endDate: alsoP });
    const data = await sim.makeRequest();
    expect(data).toBeDefined();
  });

  it('makeRequest() throws in all-at-once mode (frequency=0)', async () => {
    const sim = new BlipBurst({ frequency: 0, total: 1 });
    await expect(sim.makeRequest()).rejects.toThrow('Error from moon - all at once');
    // second call succeeds
    const data = await sim.makeRequest();
    expect(data).toBeDefined();
  });
});

describe('BlipBurst - new fault injection', () => {
  it('getMetrics returns valid structure', async () => {
    const sim = new BlipBurst({ faults: [], seed: 1 });
    await sim.makeRequest();
    const m = sim.getMetrics();
    expect(m).toHaveProperty('totalRequests');
    expect(m).toHaveProperty('latency.p50');
    expect(m).toHaveProperty('circuitBreakerState');
  });

  it('interceptFetch patches and restores global fetch', () => {
    const original = globalThis.fetch;
    const restore = BlipBurst.interceptFetch({ faults: [{ kind: 'latency', minMs: 0, maxMs: 1 }] });
    expect(globalThis.fetch).not.toBe(original);
    restore();
    expect(globalThis.fetch).toBe(original);
  });

  it('runScenario switches active profile', () => {
    const sim = new BlipBurst({ profile: 'slowdown' });
    sim.runScenario('outage');
    const faults = (sim as any).activeFaults;
    expect(faults[0].kind).toBe('httpError');
    expect(faults[0].statusCode).toBe(503);
  });

  it('startRecording/stopRecording returns FaultSequence', async () => {
    const sim = new BlipBurst({
      faults: [{ kind: 'httpError', statusCode: 503, probability: 1.0 }],
      seed: 42,
    });
    sim.startRecording();
    try { await sim.makeRequest(); } catch {}
    const seq = sim.stopRecording();
    expect(seq.events).toBeDefined();
    expect(seq.recordedAt).toBeDefined();
  });
});
