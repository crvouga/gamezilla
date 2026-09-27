/**
 * Stripe's `Idempotency-Key`. The first request with a key runs and its
 * answer is saved; a retry with the same key and the same parameters within
 * 24 hours gets that answer back (`Idempotent-Replayed: true`) and runs
 * nothing, and the same key with different parameters is an
 * `idempotency_error`. As on Stripe, a request that failed validation is not
 * saved, so fixing it and retrying with the key works.
 */
import {
  MOCK_BILLING_IDEMPOTENCY_HEADER,
  MOCK_BILLING_IDEMPOTENT_REPLAYED_HEADER,
} from '@pkgs/billing-mock/wire';
import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { idempotencyMismatch, invalidRequest } from '../errors';
import type { IdempotentResponse } from '../store';
import type { ProviderRunner } from './runner';

const KEY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 255;

/** Answers that never ran: validation, auth, not found, rate limited. */
const NOT_SAVED: ReadonlySet<number> = new Set([400, 401, 404, 429]);

async function lookup(
  runner: ProviderRunner,
  key: string
): Promise<{
  readonly saved: IdempotentResponse | null;
  readonly nowMs: number;
}> {
  return await runner.run(async (engine) => {
    const nowMs = engine.deps.clock.now();
    const saved = await engine.db.idempotentResponse(key);
    const live = saved !== null && nowMs - saved.firstSeenMs < KEY_TTL_MS;
    return { saved: live ? saved : null, nowMs };
  });
}

function replay(c: Context, key: string, saved: IdempotentResponse) {
  c.header(MOCK_BILLING_IDEMPOTENCY_HEADER, key);
  c.header(MOCK_BILLING_IDEMPOTENT_REPLAYED_HEADER, 'true');
  c.header('content-type', 'application/json');
  return c.body(saved.response, saved.status as ContentfulStatusCode);
}

export function idempotency(runner: ProviderRunner): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header(MOCK_BILLING_IDEMPOTENCY_HEADER);
    if (key === undefined || c.req.method === 'GET') return await next();
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
      const error = invalidRequest(
        `Idempotency-Key must be 1–${String(MAX_KEY_LENGTH)} characters.`
      );
      return c.json(error.toBody(), 400);
    }
    const fingerprint = `${c.req.method} ${c.req.path} ${await c.req.text()}`;
    const { saved, nowMs } = await lookup(runner, key);
    if (saved !== null) {
      if (saved.fingerprint !== fingerprint) {
        return c.json(idempotencyMismatch(key).toBody(), 400);
      }
      return replay(c, key, saved);
    }
    await next();
    if (NOT_SAVED.has(c.res.status)) return undefined;
    const response = await c.res.clone().text();
    await runner.run((engine) =>
      engine.db.saveIdempotentResponse(key, {
        fingerprint,
        status: c.res.status,
        response,
        firstSeenMs: nowMs,
      })
    );
    c.res.headers.set(MOCK_BILLING_IDEMPOTENCY_HEADER, key);
    return undefined;
  };
}
