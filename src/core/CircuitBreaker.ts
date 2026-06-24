import type { CircuitBreakerOptions, CircuitState } from '../types.js';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastOpenedAt = 0;
  private readonly opts: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.opts = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 60000,
    };
  }

  getState(): CircuitState { return this.state; }

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastOpenedAt >= this.opts.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.opts.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    if (this.state === 'half-open') {
      this.state = 'open';
      this.lastOpenedAt = Date.now();
      return;
    }
    this.failureCount++;
    if (this.failureCount >= this.opts.failureThreshold) {
      this.state = 'open';
      this.lastOpenedAt = Date.now();
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastOpenedAt = 0;
  }
}
