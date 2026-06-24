import type { FailureProfile, ProfileName } from '../types.js';

export const BUILTIN_PROFILES: Record<ProfileName, FailureProfile> = {
  flaky: {
    name: 'flaky',
    faults: [
      { kind: 'httpError', statusCode: 503, probability: 0.3 },
      { kind: 'latency', minMs: 100, maxMs: 500, probability: 0.4 },
    ],
    retry: { maxRetries: 3, backoff: 'exponential', initialDelay: 100, jitter: true },
  },
  cascade: {
    name: 'cascade',
    faults: [{ kind: 'httpError', statusCode: 503, probability: 0.8 }],
    retry: { maxRetries: 1, backoff: 'fixed', initialDelay: 200 },
    circuitBreaker: { failureThreshold: 3, successThreshold: 2, timeout: 30000 },
  },
  brownout: {
    name: 'brownout',
    faults: [
      { kind: 'latency', minMs: 2000, maxMs: 8000, probability: 0.7 },
      { kind: 'httpError', statusCode: 503, probability: 0.2 },
    ],
  },
  outage: {
    name: 'outage',
    faults: [{ kind: 'httpError', statusCode: 503, probability: 1.0 }],
    circuitBreaker: { failureThreshold: 1, successThreshold: 1, timeout: 60000 },
  },
  slowdown: {
    name: 'slowdown',
    faults: [{ kind: 'latency', minMs: 500, maxMs: 3000, probability: 0.9 }],
  },
};

export function resolveProfile(profile: ProfileName | FailureProfile): FailureProfile {
  if (typeof profile === 'string') {
    const found = BUILTIN_PROFILES[profile];
    if (!found) throw new Error(`Unknown BlipBurst profile: "${profile}"`);
    return found;
  }
  return profile;
}
