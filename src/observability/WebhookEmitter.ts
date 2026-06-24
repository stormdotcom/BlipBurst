import type { LogEntry, WebhookOptions } from '../types.js';

export class WebhookEmitter {
  constructor(private options: WebhookOptions, private fetchFn: typeof fetch) {}

  emit(entry: LogEntry): void {
    if (!this.shouldEmit(entry.event)) return;
    const payload = this.options.transform ? this.options.transform(entry) : entry;
    // fire-and-forget
    this.fetchFn(this.options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.options.headers },
      body: JSON.stringify(payload),
    }).catch(() => { /* silent - never block request path */ });
  }

  private shouldEmit(event: string): boolean {
    return !this.options.events || this.options.events.includes(event);
  }
}
