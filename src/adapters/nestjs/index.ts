import { Module, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { BlipBurst } from '../../core/BlipBurst.js';
import type { BlipBurstOptions } from '../../types.js';

@Injectable()
export class BlipBurstService {
  private instance: BlipBurst;
  constructor(options: BlipBurstOptions) { this.instance = new BlipBurst(options); }
  getInstance(): BlipBurst { return this.instance; }
}

@Injectable()
export class BlipBurstInterceptor implements NestInterceptor {
  constructor(private service: BlipBurstService) {}
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
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

@Module({})
export class BlipBurstModule {
  static forRoot(options: BlipBurstOptions) {
    return {
      module: BlipBurstModule,
      providers: [{ provide: BlipBurstService, useValue: new BlipBurstService(options) }, BlipBurstInterceptor],
      exports: [BlipBurstService, BlipBurstInterceptor],
    };
  }
}
