import type { Fault, FaultEvent, FaultSequence } from '../types.js';

export class FaultRecorder {
  private recording = false;
  private events: FaultEvent[] = [];
  private _requestIndex = 0;

  startRecording(): void {
    this.recording = true;
    this.events = [];
  }

  stopRecording(): FaultSequence {
    this.recording = false;
    return {
      events: [...this.events],
      recordedAt: new Date().toISOString(),
    };
  }

  record(fault: Fault, url: string): void {
    if (!this.recording) return;
    this.events.push({ timestamp: Date.now(), fault, url, requestIndex: this._requestIndex });
  }

  incrementIndex(): void { this._requestIndex++; }
  get requestIndex(): number { return this._requestIndex; }
  get isRecording(): boolean { return this.recording; }
}
