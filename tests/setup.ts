import { vi } from 'vitest';

globalThis.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }),
);
