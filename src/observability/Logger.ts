import type { LogEntry, LogLevel, LoggerOptions, LogTransport } from '../types.js';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

export class Logger {
  private level: number;
  private transport: LogTransport;

  constructor(options: LoggerOptions = {}) {
    this.level = LEVEL_ORDER[options.level ?? 'info'];
    this.transport = options.transport ?? ((entry) => console.log(JSON.stringify(entry)));
  }

  debug(event: string, data?: Record<string, unknown>): void { this.emit('debug', event, data); }
  info(event: string, data?: Record<string, unknown>): void { this.emit('info', event, data); }
  warn(event: string, data?: Record<string, unknown>): void { this.emit('warn', event, data); }
  error(event: string, data?: Record<string, unknown>): void { this.emit('error', event, data); }

  emit(level: LogLevel, event: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < this.level) return;
    const entry: LogEntry = { timestamp: new Date().toISOString(), level, event, ...(data ? { data } : {}) };
    this.transport(entry);
  }
}
