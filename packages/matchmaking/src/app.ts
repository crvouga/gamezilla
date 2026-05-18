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
 * Zero-side-effect request layer (chess.com scale): `/join`, `/leave`, and
 * `/status` each issue exactly one SQL statement (status may issue a
 * second indexed SELECT to fetch peers when matched) and return. There
 * are NO opportunistic match passes, NO sweeps, and NO `waitUntil`
 * background calls. Every match-making and sweep operation lives in the
 * host-owned scheduler (cron, queue, Durable Object alarm) which drives
 * `Matchmaking.tick()`. This is the design point that lets the request
 * envelope scale near-linearly with isolate count instead of multiplying
 * each poll by 3 SQL roundtrips against the primary.
 *
 * `/status` responses carry `Cache-Control: private, max-age=1` so client
 * browsers and any cache that respects `private` collapse sub-second
 * polling bursts.
 */

import { Assert, ValidationError } from '@gamezilla/lib/assert';
import type { AttributeState } from '@gamezilla/lib/attribute';
import { assertKeywordRecord } from '@gamezilla/lib/keyword';
import { Hono, type MiddlewareHandler } from 'hono';
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
};

export function createMatchmakingApp(opts: CreateMatchmakingAppOptions): Hono {
  const { matchmaker, requireAuth } = opts;
  const app = new Hono();
  app.use('*', requireAuth);

  app.post('/join', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseJoinBody(raw);
    const result = await matchmaker.joinRaw(body);
    return c.json(result);
  });

  app.post('/leave', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseLeaveBody(raw);
    const result = await matchmaker.leave(body.participantId);
    return c.json(result);
  });

  app.get('/status/:participantId', async (c) => {
    const participantId = c.req.param('participantId');
    const result = await matchmaker.status(participantId);
    if (result === null) return c.json({ error: 'not found' }, 404);
    c.header('Cache-Control', 'private, max-age=1');
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
