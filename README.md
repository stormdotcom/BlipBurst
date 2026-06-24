# BlipBurst

**BlipBurst** is a TypeScript chaos engineering library for simulating real-world network failures — latency spikes, connection resets, partial body corruption, HTTP errors, and cascading failures. Works in Node.js (NestJS, Express), browsers (React, Angular, Vue), and CI pipelines with deterministic seeded randomness.

## Features

- **Fault injection**: latency, connection resets, timeouts, body corruption, HTTP errors
- **Circuit breaker**: open / half-open / closed states (Netflix Hystrix-style)
- **Retry strategies**: fixed, linear, exponential backoff with optional jitter
- **Failure profiles**: named presets (`flaky`, `cascade`, `brownout`, `outage`, `slowdown`)
- **Intercept mode**: patch `fetch`/axios/Angular HttpClient globally — zero callsite changes
- **Observability**: p50/p95/p99 metrics, structured JSON logger, webhook emitter (Slack/PagerDuty), OpenTelemetry spans
- **Seeded randomness**: deterministic fault injection for reproducible CI runs
- **Failure recorder/replay**: capture a fault sequence and replay it exactly
- **Framework adapters**: NestJS module, Express middleware, React hook
- **Testing utilities**: `withBlip()` and `expectRetried()` for Vitest/Jest
- **CLI**: `npx blipburst simulate --profile flaky --url https://api.example.com`

## Installation

```bash
npm install blipburst
```

### Optional peer dependencies

Install only what you use:

```bash
# Axios intercept mode
npm install axios

# OpenTelemetry spans
npm install @opentelemetry/api

# React hook
npm install react

# NestJS module
npm install @nestjs/common

# Express middleware
npm install express
```

---

## Quick Start

```ts
import { BlipBurst } from 'blipburst';

// Legacy API — unchanged, fully backward compatible
const sim = new BlipBurst({
  startDate: '2025-05-15T00:00:00Z',
  endDate: '2025-05-15T23:59:59Z',
  frequency: 3,
  total: 10,
});

const data = await sim.makeRequest();
```

---

## Fault Injection

### Fault types

```ts
const sim = new BlipBurst({
  faults: [
    // Add artificial latency (100–500ms, fires 40% of the time)
    { kind: 'latency', minMs: 100, maxMs: 500, probability: 0.4 },

    // Return HTTP 503 (fires 20% of the time)
    { kind: 'httpError', statusCode: 503, probability: 0.2 },

    // Corrupt the response body
    { kind: 'corruption', strategy: 'garbledJson', probability: 0.05 },

    // Simulate connection reset
    { kind: 'reset', probability: 0.02 },

    // Force timeout after 2 seconds
    { kind: 'timeout', afterMs: 2000, probability: 0.1 },
  ],
});
```

### Failure profiles (presets)

```ts
const sim = new BlipBurst({ profile: 'flaky' });
// flaky    — httpError 503@30% + latency 100–500ms@40%, retries 3x exponential
// cascade  — httpError 503@80%, circuit breaker opens at 3 failures
// brownout — latency 2–8s@70% + httpError 503@20%
// outage   — httpError 503@100%, circuit breaker opens immediately
// slowdown — latency 500ms–3s@90%
```

---

## Retry Strategies

```ts
const sim = new BlipBurst({
  faults: [{ kind: 'httpError', statusCode: 503 }],
  retry: {
    maxRetries: 3,
    backoff: 'exponential',   // 'fixed' | 'linear' | 'exponential'
    initialDelay: 100,        // ms
    maxDelay: 5000,           // ms cap
    jitter: true,             // ±25% randomness
    retryOn: [500, 502, 503], // status codes to retry
  },
});
```

---

## Circuit Breaker

```ts
const sim = new BlipBurst({
  faults: [{ kind: 'httpError', statusCode: 503, probability: 0.8 }],
  circuitBreaker: {
    failureThreshold: 5,   // open after 5 consecutive failures
    successThreshold: 2,   // close after 2 successes in half-open
    timeout: 30000,        // ms before attempting half-open
  },
});

const metrics = sim.getMetrics();
console.log(metrics.circuitBreakerState); // 'closed' | 'open' | 'half-open'
```

---

## Intercept Mode

Patch `fetch` globally — every existing call in your app gets fault-injected. No callsite changes needed.

```ts
import { BlipBurst } from 'blipburst';

// At app init
const restore = BlipBurst.interceptFetch({
  faults: [{ kind: 'latency', minMs: 200, maxMs: 800, probability: 0.3 }],
});

// Every fetch() call now has simulated latency — including library code

// Restore original fetch
restore();
```

### Axios intercept

```ts
import axios from 'axios';
import { BlipBurst } from 'blipburst';

const restore = BlipBurst.interceptAxios(axios, {
  profile: 'flaky',
});

restore(); // removes interceptors
```

### Angular HttpClient intercept

```ts
import { BlipBurst } from 'blipburst';

// In your AppModule or a provider
BlipBurst.interceptAngular(httpBackend, {
  faults: [{ kind: 'httpError', statusCode: 503, probability: 0.1 }],
});
```

---

## Observability

### Metrics

```ts
const sim = new BlipBurst({ profile: 'flaky', seed: 42 });

for (let i = 0; i < 100; i++) {
  try { await sim.makeRequest(); } catch {}
}

const m = sim.getMetrics();
console.log(m.latency.p50);  // median latency ms
console.log(m.latency.p95);  // 95th percentile
console.log(m.latency.p99);  // 99th percentile
console.log(m.faultStats);   // { httpError: 28, latency: 41 }
console.log(m.retryCount);   // total retries across all requests
```

### Structured JSON logger

```ts
const sim = new BlipBurst({
  faults: [{ kind: 'httpError', statusCode: 500 }],
  logger: {
    level: 'info',
    transport: (entry) => myLoggingSystem.write(entry), // pluggable
  },
});
```

### Webhook emitter (Slack / PagerDuty)

```ts
const sim = new BlipBurst({
  faults: [{ kind: 'httpError', statusCode: 503 }],
  webhook: {
    url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
    transform: (event) => ({
      text: `BlipBurst fault: ${event.event} at ${event.timestamp}`,
    }),
    events: ['fault.injected', 'circuit.opened'], // filter specific events
  },
});
```

### OpenTelemetry spans

```ts
// Requires: npm install @opentelemetry/api
const sim = new BlipBurst({
  faults: [{ kind: 'latency', minMs: 100, maxMs: 500 }],
  otel: true, // every fault becomes a traceable span
});
```

---

## Seeded Randomness

Make fault injection deterministic for CI:

```ts
const sim = new BlipBurst({
  profile: 'flaky',
  seed: 12345, // same seed → same fault sequence every run
});
```

---

## Failure Recorder & Replay

Capture a real fault sequence and replay it exactly:

```ts
// Record
const sim = new BlipBurst({ profile: 'flaky' });
sim.startRecording();
for (let i = 0; i < 20; i++) {
  try { await sim.makeRequest(); } catch {}
}
const sequence = sim.stopRecording();
// Save to disk: JSON.stringify(sequence)

// Replay (exact same faults, same order)
const replay = BlipBurst.replay(sequence);
await replay.makeRequest(); // replays recorded fault #1
```

---

## Scenario Runner

Switch failure profiles at runtime without creating a new instance:

```ts
const sim = new BlipBurst({ profile: 'slowdown' });
// ... run tests

sim.runScenario('cascade'); // switch to cascade scenario
// ... run more tests

sim.runScenario('flaky');
```

---

## Framework Adapters

### NestJS

```ts
// app.module.ts
import { BlipBurstModule } from 'blipburst/nestjs';

@Module({
  imports: [
    BlipBurstModule.forRoot({
      profile: 'flaky',
      webhook: { url: 'https://hooks.slack.com/...' },
    }),
  ],
})
export class AppModule {}
```

```ts
// In a service or controller
import { BlipBurstInterceptor } from 'blipburst/nestjs';

@UseInterceptors(BlipBurstInterceptor)
@Get('data')
async getData() { ... }
```

### Express

```ts
import express from 'express';
import { blipburstMiddleware } from 'blipburst/express';

const app = express();

app.use(blipburstMiddleware({
  faults: [{ kind: 'latency', minMs: 200, maxMs: 800, probability: 0.3 }],
}));
```

### React hook

```tsx
import { useBlipBurst } from 'blipburst/react';

function MyComponent() {
  const { makeRequest, getMetrics } = useBlipBurst({
    profile: 'flaky',
  });

  const handleClick = async () => {
    try {
      const data = await makeRequest();
      console.log(data);
    } catch (e) {
      console.error(e);
    }
    console.log(getMetrics().latency.p99);
  };

  return <button onClick={handleClick}>Test</button>;
}
```

---

## Testing Utilities

```ts
import { withBlip, expectRetried } from 'blipburst/testing';
import { describe, it } from 'vitest';

describe('my service', () => {
  it('retries 3 times on 503', withBlip(
    { faults: [{ kind: 'httpError', statusCode: 503 }], retry: { maxRetries: 3 } },
    async (sim) => {
      try { await sim.makeRequest(); } catch {}
      expectRetried(sim, 3);
    }
  ));
});
```

---

## CLI

```bash
# Simulate with a named profile
npx blipburst simulate --profile flaky --url https://api.example.com --count 20

# Simulate with a specific fault
npx blipburst simulate --fault httpError:503:0.5 --url https://api.example.com

# Replay a recorded fault sequence
npx blipburst replay --from recorded-sequence.json
```

---

## API Reference

### `new BlipBurst(options)`

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `startDate` | `Date \| string` | Start of error window | `new Date()` |
| `endDate` | `Date \| string` | End of error window | 4 days from start |
| `frequency` | `number` | Errors per minute (legacy, 0=all at once) | `1/(24*60)` |
| `total` | `number` | Total legacy errors | `4` |
| `url` | `string` | URL for `makeRequest()` | jsonplaceholder |
| `faults` | `Fault[]` | Fault injection config | `[]` |
| `profile` | `ProfileName \| FailureProfile` | Named preset or custom profile | — |
| `retry` | `RetryOptions` | Retry + backoff config | — |
| `circuitBreaker` | `CircuitBreakerOptions` | Circuit breaker config | — |
| `seed` | `number \| string` | Seed for deterministic faults | random |
| `logger` | `LoggerOptions` | Structured logger config | — |
| `webhook` | `WebhookOptions` | Webhook emitter config | — |
| `otel` | `boolean` | Enable OpenTelemetry spans | `false` |

### Fault types

| `kind` | Fields | Description |
|--------|--------|-------------|
| `latency` | `minMs`, `maxMs`, `probability?` | Inject artificial delay |
| `httpError` | `statusCode`, `body?`, `probability?` | Return HTTP error response |
| `corruption` | `strategy?`, `probability?` | Corrupt response body (`nullBody`, `garbledJson`, `truncate`) |
| `reset` | `probability?` | Simulate connection reset (AbortError) |
| `timeout` | `afterMs`, `probability?` | Abort request after N ms |

### Instance methods

| Method | Returns | Description |
|--------|---------|-------------|
| `makeRequest(url?)` | `Promise<any>` | Make request with fault injection |
| `getMetrics()` | `Metrics` | Get p50/p95/p99 latency + fault stats |
| `resetMetrics()` | `void` | Clear accumulated metrics |
| `startRecording()` | `void` | Begin recording fault events |
| `stopRecording()` | `FaultSequence` | Stop recording, return sequence |
| `runScenario(profile)` | `void` | Switch to a new failure profile |

### Static methods

| Method | Returns | Description |
|--------|---------|-------------|
| `BlipBurst.interceptFetch(options)` | `() => void` | Patch global fetch, returns restore fn |
| `BlipBurst.interceptAxios(instance, options)` | `() => void` | Patch axios instance, returns restore fn |
| `BlipBurst.interceptAngular(backend, options)` | `() => void` | Patch Angular HttpBackend, returns restore fn |
| `BlipBurst.replay(sequence)` | `BlipBurst` | Create instance that replays a recorded sequence |

---

## License

MIT © Ajmal N
