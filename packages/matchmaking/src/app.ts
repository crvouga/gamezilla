/**
 * `createMatchmakingApp` mounts the queue API on a fresh Hono instance and
 * applies the host-supplied `requireAuth` middleware to every route. The
 * library has zero opinion on how auth works — `requireAuth` is responsible
 * for rejecting unauthorized requests.
 *
 * Body validation uses an `Assert.validation()` instance so failures throw
 * `ValidationError` and are mapped to HTTP 400. The keyword check on `data`
 * makes it physically impossible for a non-namespaced key to land in
 * Postgres via this surface. Formulas cross the HTTP wire as plain JSON
 * (no `AttributeTag` objects) — see {@link FormulaWire}.
 *
 * Routes:
 *   POST /join                   -> { data, formulas } -> { participantId }
 *   POST /leave                  -> { participantId }  -> { removed }
 *   GET  /status/:participantId  ->                    -> StatusResult | 404
 *
 * Opportunistic match passes: every `/join` and `/status` fires a
 * non-blocking `runMatchPass(sig)` + `sweepExpired(sig)` + `sweepMatched()`
 * via `c.executionCtx.waitUntil(...)` after sending the response. `sig`
 * is computed from the request's `data` (join body or status row) so a
 * `/join` to one partition only kicks that partition's matcher. The
 * SQL-side throttles (per-partition for pass/sweep, global for
 * sweepMatched) coalesce concurrent triggers, so the cost stays flat
 * regardless of poller count and no separate scheduler / cron / Durable
 * Object is required. High-traffic partitions get more pass triggers
 * proportional to their poller count — natural load balancing, free. Set
 * `passOnRequest: 'never'` to disable when the host runs its own scheduler.
 */

import { Assert, ValidationError } from '@gamezilla/lib/assert';
import type { AttributeState } from '@gamezilla/lib/attribute';
import { assertKeywordRecord } from '@gamezilla/lib/keyword';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type {
  CategoricalTermWire,
  FormulaWire,
  JoinInputRaw,
  Matchmaker,
  NumericTermWire,
  PartitionTermWire,
} from './matchmaker';

type LeaveBody = { readonly participantId: string };

function parseNumericTerms(
  v: Assert,
  raw: unknown,
  label: string
): readonly NumericTermWire[] {
  v.array(raw, `${label} must be an array`);
  const out: NumericTermWire[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item: unknown = raw[i];
    v.record(item, `${label}[${String(i)}] must be an object`);
    const path: unknown = item['path'];
    const weight: unknown = item['weight'];
    v.nonEmptyString(
      path,
      `${label}[${String(i)}].path must be a non-empty string`
    );
    v.ok(
      typeof weight === 'number' && Number.isFinite(weight) && weight >= 0,
      `${label}[${String(i)}].weight must be a non-negative finite number`
    );
    out.push({ path, weight });
  }
  return out;
}

function parseCategoricalTerms(
  v: Assert,
  raw: unknown,
  label: string
): readonly CategoricalTermWire[] {
  v.array(raw, `${label} must be an array`);
  const out: CategoricalTermWire[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item: unknown = raw[i];
    v.record(item, `${label}[${String(i)}] must be an object`);
    const path: unknown = item['path'];
    const penalty: unknown = item['penalty'];
    v.nonEmptyString(
      path,
      `${label}[${String(i)}].path must be a non-empty string`
    );
    v.ok(
      typeof penalty === 'number' && Number.isFinite(penalty) && penalty >= 0,
      `${label}[${String(i)}].penalty must be a non-negative finite number`
    );
    out.push({ path, penalty });
  }
  return out;
}

function parsePartitionTerms(
  v: Assert,
  raw: unknown,
  label: string
): readonly PartitionTermWire[] {
  v.array(raw, `${label} must be an array`);
  const out: PartitionTermWire[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item: unknown = raw[i];
    v.record(item, `${label}[${String(i)}] must be an object`);
    const path: unknown = item['path'];
    v.nonEmptyString(
      path,
      `${label}[${String(i)}].path must be a non-empty string`
    );
    out.push({ path });
  }
  return out;
}

function parseFormula(v: Assert, raw: unknown, label: string): FormulaWire {
  v.record(raw, `${label} must be an object`);
  const numericRaw: unknown = raw['numeric'];
  const categoricalRaw: unknown = raw['categorical'];
  const partitionRaw: unknown = raw['partition'];
  const numeric = parseNumericTerms(v, numericRaw, `${label}.numeric`);
  const categorical =
    categoricalRaw === undefined
      ? []
      : parseCategoricalTerms(v, categoricalRaw, `${label}.categorical`);
  const partition =
    partitionRaw === undefined
      ? []
      : parsePartitionTerms(v, partitionRaw, `${label}.partition`);
  v.ok(
    numeric.length + categorical.length + partition.length > 0,
    `${label} must declare at least one numeric, categorical, or partition term`
  );
  return { numeric, categorical, partition };
}

function parseJoinBody(raw: unknown): JoinInputRaw {
  const v: Assert = Assert.validation();
  v.record(raw, 'body must be a JSON object');
  const dataValue: unknown = raw['data'];
  v.record(dataValue, 'data must be a plain object');
  assertKeywordRecord(v, dataValue, 'data');
  const formulasRaw: unknown = raw['formulas'];
  v.array(formulasRaw, 'formulas must be an array');
  v.ok(formulasRaw.length > 0, 'formulas must be non-empty');
  const formulas: FormulaWire[] = [];
  for (let i = 0; i < formulasRaw.length; i += 1) {
    formulas.push(parseFormula(v, formulasRaw[i], `formulas[${String(i)}]`));
  }
  return { data: dataValue as AttributeState, formulas };
}

function parseLeaveBody(raw: unknown): LeaveBody {
  const v: Assert = Assert.validation();
  v.record(raw, 'body must be a JSON object');
  const participantId: unknown = raw['participantId'];
  v.nonEmptyString(participantId, 'participantId must be a non-empty string');
  return { participantId };
}

export type CreateMatchmakingAppOptions = {
  readonly matchmaker: Matchmaker;
  readonly requireAuth: MiddlewareHandler;
  /**
   * When `'auto'` (default), every `/join` and `/status` opportunistically
   * fires a non-blocking `runMatchPass()` + `sweepExpired()` via
   * `c.executionCtx.waitUntil(...)`. Server-side throttles inside Postgres
   * coalesce concurrent triggers; the polling stream is enough to keep
   * the queue draining without any cron / DO.
   *
   * Set to `'never'` if the host wires its own scheduler — useful when
   * matches are produced via webhook / cron rather than long polling.
   */
  readonly passOnRequest?: 'auto' | 'never';
};

function getExecutionCtx(
  c: Context
): { waitUntil(p: Promise<unknown>): void } | undefined {
  try {
    const ec = c.executionCtx;
    if (
      ec !== undefined &&
      ec !== null &&
      typeof (ec as { waitUntil?: unknown }).waitUntil === 'function'
    ) {
      return ec as { waitUntil(p: Promise<unknown>): void };
    }
    return undefined;
  } catch {
    // Hono throws when there's no execution context (Node test client,
    // PGlite-driven tests, etc.). Fall through to fire-and-forget.
    return undefined;
  }
}

function kickPass(
  c: Context,
  matchmaker: Matchmaker,
  passOnRequest: 'auto' | 'never',
  partitionSignature: string
): void {
  if (passOnRequest === 'never') return;
  const pass = matchmaker.runMatchPass(partitionSignature).then(
    () => undefined,
    () => undefined
  );
  const sweep = matchmaker.sweepExpired(partitionSignature).then(
    () => undefined,
    () => undefined
  );
  const cleanup = matchmaker.sweepMatched().then(
    () => undefined,
    () => undefined
  );
  const ec = getExecutionCtx(c);
  if (ec !== undefined) {
    ec.waitUntil(pass);
    ec.waitUntil(sweep);
    ec.waitUntil(cleanup);
  }
  // else: fire-and-forget — every promise keeps its own error handler so
  // an unhandled rejection cannot escape.
}

export function createMatchmakingApp(opts: CreateMatchmakingAppOptions): Hono {
  const { matchmaker, requireAuth } = opts;
  const passOnRequest = opts.passOnRequest ?? 'auto';
  const app = new Hono();
  app.use('*', requireAuth);

  app.post('/join', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseJoinBody(raw);
    const result = await matchmaker.joinRaw(body);
    const sig = matchmaker.partitionSignatureFor(body.data);
    kickPass(c, matchmaker, passOnRequest, sig);
    return c.json(result);
  });

  app.post('/leave', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseLeaveBody(raw);
    const result = await matchmaker.leave(body.participantId);
    // No opportunistic pass: removing a row never enables a new pairing.
    return c.json(result);
  });

  app.get('/status/:participantId', async (c) => {
    const participantId = c.req.param('participantId');
    const result = await matchmaker.status(participantId);
    if (result === null) return c.json({ error: 'not found' }, 404);
    const sig = matchmaker.partitionSignatureFor(result.data);
    kickPass(c, matchmaker, passOnRequest, sig);
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
