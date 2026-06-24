import type { Request, Response, NextFunction } from 'express';
import { BlipBurst } from '../../core/BlipBurst.js';
import type { BlipBurstOptions } from '../../types.js';

export function blipburstMiddleware(options: BlipBurstOptions) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const restore = BlipBurst.interceptFetch(options);
    _res.on('finish', restore);
    next();
  };
}
