import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../src/core/CircuitBreaker.js';

describe('CircuitBreaker', () => {
  it('starts closed', () => {
    expect(new CircuitBreaker().getState()).toBe('closed');
  });

  it('opens after failureThreshold failures', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    expect(cb.getState()).toBe('open');
  });

  it('isOpen returns true when open', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 99999 });
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
  });

  it('transitions to half-open after timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 50 });
    cb.recordFailure();
    await new Promise(r => setTimeout(r, 60));
    expect(cb.isOpen()).toBe(false);
    expect(cb.getState()).toBe('half-open');
  });

  it('closes from half-open after successThreshold successes', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 2, timeout: 10 });
    cb.recordFailure();
    await new Promise(r => setTimeout(r, 20));
    cb.isOpen(); // trigger half-open transition
    cb.recordSuccess(); cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
  });

  it('reset returns to closed', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    cb.reset();
    expect(cb.getState()).toBe('closed');
    expect(cb.isOpen()).toBe(false);
  });
});
