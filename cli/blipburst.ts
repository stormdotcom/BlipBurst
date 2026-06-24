#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { BlipBurst } from '../src/core/BlipBurst.js';
import { BUILTIN_PROFILES } from '../src/core/FailureProfiles.js';
import type { BlipBurstOptions, Fault, ProfileName } from '../src/types.js';

const { values } = parseArgs({
  options: {
    profile: { type: 'string', short: 'p' },
    url: { type: 'string', short: 'u' },
    count: { type: 'string', short: 'n', default: '10' },
    fault: { type: 'string', short: 'f' },
  },
  strict: false,
});

async function main(): Promise<void> {
  const count = parseInt(values.count as string ?? '10', 10);
  const options: BlipBurstOptions = { url: values.url as string | undefined };

  if (values.profile) {
    options.profile = values.profile as ProfileName;
  }

  if (values.fault) {
    // Format: kind:param1:param2 e.g. httpError:503:0.5 or latency:100:500:0.3
    const parts = (values.fault as string).split(':');
    const kind = parts[0];
    if (kind === 'httpError') {
      options.faults = [{ kind: 'httpError', statusCode: parseInt(parts[1] ?? '503'), probability: parseFloat(parts[2] ?? '1') }];
    } else if (kind === 'latency') {
      options.faults = [{ kind: 'latency', minMs: parseInt(parts[1] ?? '100'), maxMs: parseInt(parts[2] ?? '500'), probability: parseFloat(parts[3] ?? '1') }];
    }
  }

  const sim = new BlipBurst(options);
  let successes = 0, failures = 0;

  console.log(`Running ${count} requests with BlipBurst...`);
  for (let i = 0; i < count; i++) {
    try {
      await sim.makeRequest();
      successes++;
    } catch {
      failures++;
    }
  }

  const metrics = sim.getMetrics();
  console.log('\nResults:');
  console.log(`  Successes: ${successes}, Failures: ${failures}`);
  console.log(`  Latency p50: ${metrics.latency.p50}ms, p95: ${metrics.latency.p95}ms, p99: ${metrics.latency.p99}ms`);
  console.log(`  Circuit breaker: ${metrics.circuitBreakerState}`);
  console.log(`  Fault stats: ${JSON.stringify(metrics.faultStats)}`);
}

main().catch(console.error);
