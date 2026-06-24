import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../src/core/SeededRandom.js';

describe('SeededRandom', () => {
  it('produces identical sequences for same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    let diff = false;
    for (let i = 0; i < 10; i++) if (a.next() !== b.next()) { diff = true; break; }
    expect(diff).toBe(true);
  });

  it('nextInt returns values in range', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('chance returns boolean with roughly correct distribution', () => {
    const rng = new SeededRandom(42);
    let trues = 0;
    for (let i = 0; i < 1000; i++) if (rng.chance(0.5)) trues++;
    expect(trues).toBeGreaterThan(400);
    expect(trues).toBeLessThan(600);
  });

  it('accepts string seeds', () => {
    const a = new SeededRandom('hello');
    const b = new SeededRandom('hello');
    expect(a.next()).toBe(b.next());
  });
});
