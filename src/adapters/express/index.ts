import { BlipBurst } from '../../core/BlipBurst.js';
import type { BlipBurstOptions } from '../../types.js';

// Express adapter — avoids importing from 'express' directly so no peer dep is needed at build time.

export function blipburstMiddleware(options: BlipBurstOptions) {
  return (_req: unknown, _res: { on(event: string, fn: () => void): void }, next: () => void): void => {
    const restore = BlipBurst.interceptFetch(options);
    _res.on('finish', restore);
    next();
  };
}
