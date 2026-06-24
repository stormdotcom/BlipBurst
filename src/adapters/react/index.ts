// React adapter — uses dynamic require to avoid peer dep at build/type-check time.
import { BlipBurst } from '../../core/BlipBurst.js';
import type { BlipBurstOptions, Metrics } from '../../types.js';

export function useBlipBurst(options: BlipBurstOptions): {
  makeRequest: (url?: string) => Promise<any>;
  getMetrics: () => Metrics;
  instance: BlipBurst;
} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useRef, useCallback } = require('react') as typeof import('react');
  const instanceRef = useRef<BlipBurst | null>(null);
  if (!instanceRef.current) {
    instanceRef.current = new BlipBurst(options);
  }
  const makeRequest = useCallback((url?: string) => instanceRef.current!.makeRequest(url), []);
  const getMetrics = useCallback(() => instanceRef.current!.getMetrics(), []);
  return { makeRequest, getMetrics, instance: instanceRef.current };
}
