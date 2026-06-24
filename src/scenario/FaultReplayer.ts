import type { Fault, FaultSequence } from '../types.js';

export class FaultReplayer {
  private events: Array<{ fault: Fault; requestIndex: number }>;
  private cursor = 0;

  constructor(sequence: FaultSequence) {
    this.events = sequence.events.map(e => ({ fault: e.fault, requestIndex: e.requestIndex }));
  }

  next(requestIndex: number): Fault | null {
    if (this.cursor >= this.events.length) return null;
    const event = this.events[this.cursor];
    if (event && event.requestIndex === requestIndex) {
      this.cursor++;
      return event.fault;
    }
    return null;
  }

  hasMore(): boolean { return this.cursor < this.events.length; }
  reset(): void { this.cursor = 0; }
}
