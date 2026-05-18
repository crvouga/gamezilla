/**
 * `createMatchmakingApp` mounts the queue API on a fresh Hono instance and
 * applies the host-supplied `requireAuth` middleware to every route. The
 * library has zero opinion on how auth works — `requireAuth` is responsible
 * for rejecting unauthorized requests.
 *
 * Routes:
 *   POST /join              -> { rating, data } -> { playerId }
 *   POST /leave             -> { playerId }     -> { removed }
 *   GET  /status/:playerId  ->                  -> { status, data } | 404
 */

import { Hono, type MiddlewareHandler } from 'hono';
import type { Matchmaker } from './matchmaker';

type JoinBody = {
  readonly rating: number;
  readonly data: Readonly<Record<string, unknown>>;
};
type LeaveBody = { readonly playerId: string };

class ValidationError extends Error {}

function parseJoinBody(raw: unknown): JoinBody {
  if (raw === null || typeof raw !== 'object') {
    throw new ValidationError('body must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const rating = obj['rating'];
  const data = obj['data'];
  if (typeof rating !== 'number' || !Number.isFinite(rating)) {
    throw new ValidationError('rating must be a finite number');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('data must be a plain object');
  }
  return { rating, data: data as Record<string, unknown> };
}

function parseLeaveBody(raw: unknown): LeaveBody {
  if (raw === null || typeof raw !== 'object') {
    throw new ValidationError('body must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const playerId = obj['playerId'];
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new ValidationError('playerId must be a non-empty string');
  }
  return { playerId };
}

export type CreateMatchmakingAppOptions = {
  readonly matchmaker: Matchmaker;
  readonly requireAuth: MiddlewareHandler;
};

export function createMatchmakingApp(opts: CreateMatchmakingAppOptions): Hono {
  const { matchmaker, requireAuth } = opts;
  const app = new Hono();
  app.use('*', requireAuth);

  app.post('/join', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseJoinBody(raw);
    const result = await matchmaker.join(body);
    await matchmaker.runMatchPass();
    return c.json(result);
  });

  app.post('/leave', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseLeaveBody(raw);
    const result = await matchmaker.leave(body.playerId);
    return c.json(result);
  });

  app.get('/status/:playerId', async (c) => {
    const playerId = c.req.param('playerId');
    const result = await matchmaker.status(playerId);
    if (result === null) return c.json({ error: 'not found' }, 404);
    return c.json(result);
  });

  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    const message = err instanceof Error ? err.message : 'internal error';
    return c.json({ error: message }, 500);
  });

  return app;
}
