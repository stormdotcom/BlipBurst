// No import for fetch here — will be assigned dynamically

export interface BlipBurstOptions {
  startDate?: Date | string;
  endDate?: Date | string;
  frequency?: number; // errors per minute, 0 = all at once
  total?: number;    // total number of errors to throw during window
  url?: string;      // URL to hit, default jsonplaceholder
}

export class BlipBurst {
  private startDate: Date;
  private endDate: Date;
  private errorFrequency: number;
  private totalErrors: number;
  private errorsThrown = 0;
  private lastErrorTime = 0;
  private url: string;
  private fetchFunc: typeof fetch;

  constructor(options: BlipBurstOptions = {}) {
    const now = new Date();

    this.startDate = options.startDate ? new Date(options.startDate) : now;
    this.endDate = options.endDate
      ? new Date(options.endDate)
      : new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days from now

    this.errorFrequency = options.frequency ?? (1 / (24 * 60)); // 1 error per day in errors per minute
    this.totalErrors = options.total ?? 4; // default 4 errors over 4 days
    this.url = options.url ?? 'https://jsonplaceholder.typicode.com/posts/1';

    if (typeof window === 'undefined') {
      // Node.js environment: dynamically require node-fetch v2
      // Use require here to avoid import errors in browsers
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.fetchFunc = require('node-fetch');
    } else {
      // Browser environment: use global fetch
      this.fetchFunc = fetch.bind(window);
    }
  }

  private isInErrorWindow(): boolean {
    const now = new Date();
    return now >= this.startDate && now <= this.endDate;
  }

  /**
   * Makes a network request to the configured URL.
   * Throws simulated errors based on frequency and time window.
   */
  public async makeRequest(): Promise<any> {
    if (!this.isInErrorWindow()) {
      return this.fetchFunc(this.url).then((res: any) => res.json());
    }

    if (this.errorFrequency === 0) {
      // Throw all errors immediately once during error window
      if (this.errorsThrown === 0) {
        this.errorsThrown++;
        throw new Error('Error from moon - all at once');
      }
      return this.fetchFunc(this.url).then((res: any) => res.json());
    }

    const now = Date.now();
    const interval = 60000 / this.errorFrequency;

    if (
      this.errorsThrown < this.totalErrors &&
      now - this.lastErrorTime >= interval
    ) {
      this.lastErrorTime = now;
      this.errorsThrown++;
      throw new Error('Error from mars - frequency mode');
    }

    return this.fetchFunc(this.url).then((res: any) => res.json());
  }
}
