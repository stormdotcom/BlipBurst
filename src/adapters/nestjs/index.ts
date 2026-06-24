import { BlipBurst } from '../../core/BlipBurst.js';
import type { BlipBurstOptions } from '../../types.js';

// NestJS adapter — decorators are applied at runtime only when @nestjs/common is available.
// We avoid direct imports from @nestjs/common so the DTS build doesn't require the peer dep.

export class BlipBurstService {
  private instance: BlipBurst;
  constructor(options: BlipBurstOptions) { this.instance = new BlipBurst(options); }
  getInstance(): BlipBurst { return this.instance; }
}

export class BlipBurstInterceptor {
  constructor(private service: BlipBurstService) {}

  intercept(_ctx: unknown, next: { handle(): any }): any {
    const options = (this.service.getInstance() as any)._options ?? {};
    const restore = BlipBurst.interceptFetch(options);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return new (require('rxjs').Observable)((subscriber: any) => {
      next.handle().subscribe({
        next: (v: any) => { restore(); subscriber.next(v); },
        error: (e: any) => { restore(); subscriber.error(e); },
        complete: () => { restore(); subscriber.complete(); },
      });
    });
  }
}

export class BlipBurstModule {
  static forRoot(options: BlipBurstOptions) {
    return {
      module: BlipBurstModule,
      providers: [{ provide: BlipBurstService, useValue: new BlipBurstService(options) }, BlipBurstInterceptor],
      exports: [BlipBurstService, BlipBurstInterceptor],
    };
  }
}
