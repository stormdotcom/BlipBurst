export type { BlipBurstOptions } from './types.js';
export { BlipBurst } from './core/BlipBurst.js';

// New exports
export type {
  Fault, LatencyFault, CorruptionFault, ResetFault, TimeoutFault, HttpErrorFault,
  FaultKind, RetryOptions, BackoffStrategy, CircuitBreakerOptions, CircuitState,
  ProfileName, FailureProfile, Metrics, LatencyStats, LogEntry, LogLevel,
  LoggerOptions, LogTransport, WebhookOptions, FaultEvent, FaultSequence,
} from './types.js';
export { BUILTIN_PROFILES, resolveProfile } from './core/FailureProfiles.js';
export { SeededRandom } from './core/SeededRandom.js';
export { BlipBurstError } from './core/FaultInjector.js';
export { CircuitBreaker } from './core/CircuitBreaker.js';
