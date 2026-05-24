import type { Context } from 'hono';
import { NO_CACHE_RESPONSE_HEADERS } from '../paths';

export function applyNoCacheHeaders(c: Context): void {
  for (const [k, v] of Object.entries(NO_CACHE_RESPONSE_HEADERS)) {
    c.header(k, v);
  }
}
