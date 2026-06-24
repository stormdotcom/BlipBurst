export type FaultKind = 'latency' | 'corruption' | 'reset' | 'timeout' | 'httpError';

export interface LatencyFault { kind: 'latency'; minMs: number; maxMs: number; probability?: number }
export interface CorruptionFault { kind: 'corruption'; strategy?: 'nullBody' | 'garbledJson' | 'truncate'; probability?: number }
export interface ResetFault { kind: 'reset'; probability?: number }
export interface TimeoutFault { kind: 'timeout'; afterMs: number; probability?: number }
export interface HttpErrorFault { kind: 'httpError'; statusCode: number; body?: string; probability?: number }
export type Fault = LatencyFault | CorruptionFault | ResetFault | TimeoutFault | HttpErrorFault;

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';
export interface RetryOptions { maxRetries?: number; backoff?: BackoffStrategy; initialDelay?: number; maxDelay?: number; jitter?: boolean; retryOn?: number[] }

export type CircuitState = 'closed' | 'open' | 'half-open';
export interface CircuitBreakerOptions { failureThreshold?: number; successThreshold?: number; timeout?: number }

export type ProfileName = 'flaky' | 'cascade' | 'brownout' | 'outage' | 'slowdown';
export interface FailureProfile { name: ProfileName | string; faults: Fault[]; retry?: RetryOptions; circuitBreaker?: CircuitBreakerOptions }

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export interface LogEntry { timestamp: string; level: LogLevel; event: string; data?: Record<string, unknown> }
export type LogTransport = (entry: LogEntry) => void;
export interface LoggerOptions { level?: LogLevel; transport?: LogTransport }

export interface WebhookOptions { url: string; transform?: (event: LogEntry) => unknown; events?: string[]; headers?: Record<string, string> }

export interface LatencyStats { p50: number; p95: number; p99: number; min: number; max: number }
export interface Metrics { totalRequests: number; successCount: number; failureCount: number; retryCount: number; latency: LatencyStats; circuitBreakerState: CircuitState; faultStats: Record<string, number> }

export interface FaultEvent { timestamp: number; fault: Fault; url: string; requestIndex: number }
export interface FaultSequence { events: FaultEvent[]; seed?: number; recordedAt: string }

export interface BlipBurstOptions {
  // legacy (backward compat)
  startDate?: Date | string;
  endDate?: Date | string;
  frequency?: number;
  total?: number;
  url?: string;
  // new
  faults?: Fault[];
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
  profile?: ProfileName | FailureProfile;
  logger?: LoggerOptions;
  webhook?: WebhookOptions;
  otel?: boolean;
  seed?: number | string;
}
