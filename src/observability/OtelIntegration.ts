export interface OtelSpan { end(): void; setStatus(s: { code: number }): void; recordException(e: Error): void }

export class OtelIntegration {
  private tracer: { startSpan(name: string, opts?: Record<string, unknown>): OtelSpan } | null = null;

  constructor() {
    import('@opentelemetry/api').then((api: any) => {
      this.tracer = api.trace.getTracer('blipburst', '2.0.0');
    }).catch(() => { /* peer dep not installed, silently skip */ });
  }

  startSpan(name: string, attributes?: Record<string, unknown>): OtelSpan | null {
    if (!this.tracer) return null;
    return this.tracer.startSpan(name, { attributes });
  }

  endSpan(span: OtelSpan | null, error?: Error): void {
    if (!span) return;
    if (error) {
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
    } else {
      span.setStatus({ code: 1 }); // OK
    }
    span.end();
  }
}
