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

import { Assert, ValidationError } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import { assertKeywordRecord } from '@pkgs/keyword';
import { createLogger } from '@pkgs/logger';
import { Hono, type MiddlewareHandler } from 'hono';
import type {
  CategoricalTermWire,
  FormulaWire,
  JoinInputRaw,
  Matchmaker,
  NumericTermWire,
  PartitionTermWire,
} from './matchmaker';
import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MAX_PRIORITY,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_MIN_PRIORITY,
} from './migrate-sql';
import { MATCHMAKING_PAYLOAD_LIMITS } from './payload-limits';

type LeaveBody = { readonly participantId: string };

/**
 * UTF-8 byte length of a string. Used by the validator to enforce
 * `maxStringBytes` against raw user input. Cached `TextEncoder` —
 * cheaper than re-allocating per call.
 */
const UTF8 = new TextEncoder();
function utf8Bytes(s: string): number {
  return UTF8.encode(s).length;
}

function assertStringByteCap(v: Assert, value: string, label: string): void {
  v.ok(
    utf8Bytes(value) <= MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes,
    `${label} must be at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes)} bytes (UTF-8)`
  );
}

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
    assertStringByteCap(v, path, `${label}[${String(i)}].path`);
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
    assertStringByteCap(v, path, `${label}[${String(i)}].path`);
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
    assertStringByteCap(v, path, `${label}[${String(i)}].path`);
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
  const termCount = numeric.length + categorical.length + partition.length;
  v.ok(
    termCount > 0,
    `${label} must declare at least one numeric, categorical, or partition term`
  );
  v.ok(
    termCount <= MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula,
    `${label} must contain at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula)} terms total (numeric + categorical + partition)`
  );
  return { numeric, categorical, partition };
}

/**
 * Enforces {@link MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes} across
 * every string value in `data`. Numbers/booleans/null are passed
 * through (already O(1) JSONB), nested objects/arrays are rejected by
 * `assertKeywordRecord` upstream so this stays a flat traversal.
 */
function assertDataValueCaps(v: Assert, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      assertStringByteCap(v, value, `data[${JSON.stringify(key)}]`);
    }
  }
}

type BoundedIntBounds = {
  readonly field: string;
  readonly min: number;
  readonly max: number;
};

/**
 * Parses + validates an optional integer field that must fall in
 * `[bounds.min, bounds.max]`. Returns the parsed integer or `undefined`
 * when the field is absent. Records validation failures on `v`.
 */
function parseOptionalBoundedInt(
  v: Assert,
  raw: unknown,
  bounds: BoundedIntBounds
): number | undefined {
  if (raw === undefined) return undefined;
  v.ok(
    typeof raw === 'number' && Number.isInteger(raw),
    `${bounds.field} must be an integer`
  );
  v.ok(
    raw >= bounds.min && raw <= bounds.max,
    `${bounds.field} must be between ${String(bounds.min)} and ${String(bounds.max)}`
  );
  return raw as number;
}

/**
 * Parses + size-caps an optional `metadata` field. Returns `null` for
 * an explicit JSON null, the parsed object for a valid object, or
 * `undefined` when the field is absent.
 */
function parseOptionalMetadata(
  v: Assert,
  raw: unknown
): Record<string, unknown> | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  v.record(raw, 'metadata must be a plain object or null');
  const encoded = JSON.stringify(raw);
  v.ok(
    utf8Bytes(encoded) <= MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes,
    `metadata JSON must be at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes)} bytes (UTF-8)`
  );
  return raw;
}

function parseJoinData(v: Assert, raw: unknown): AttributeState {
  v.record(raw, 'data must be a plain object');
  assertKeywordRecord(v, raw, 'data');
  v.ok(
    Object.keys(raw).length <= MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys,
    `data must contain at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys)} keys`
  );
  assertDataValueCaps(v, raw);
  return raw as AttributeState;
}

function parseJoinFormulas(v: Assert, raw: unknown): FormulaWire[] {
  v.array(raw, 'formulas must be an array');
  v.ok(raw.length > 0, 'formulas must be non-empty');
  v.ok(
    raw.length <= MATCHMAKING_PAYLOAD_LIMITS.maxFormulas,
    `formulas must contain at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxFormulas)} entries`
  );
  const formulas: FormulaWire[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    formulas.push(parseFormula(v, raw[i], `formulas[${String(i)}]`));
  }
  return formulas;
}

function parseJoinBody(raw: unknown): JoinInputRaw {
  const v: Assert = Assert.validation();
  v.record(raw, 'body must be a JSON object');
  const data = parseJoinData(v, raw['data']);
  const formulas = parseJoinFormulas(v, raw['formulas']);
  const groupSize = parseOptionalBoundedInt(v, raw['groupSize'], {
    field: 'groupSize',
    min: MATCHMAKING_MIN_GROUP_SIZE,
    max: MATCHMAKING_MAX_GROUP_SIZE,
  });
  const priority = parseOptionalBoundedInt(v, raw['priority'], {
    field: 'priority',
    min: MATCHMAKING_MIN_PRIORITY,
    max: MATCHMAKING_MAX_PRIORITY,
  });
  const metadata = parseOptionalMetadata(v, raw['metadata']);
  return {
    data,
    formulas,
    ...(groupSize !== undefined ? { groupSize } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

function parseUpdateFormulasBody(raw: unknown): {
  readonly formulas: readonly FormulaWire[];
} {
  const v: Assert = Assert.validation();
  v.record(raw, 'body must be a JSON object');
  const formulasRaw: unknown = raw['formulas'];
  v.array(formulasRaw, 'formulas must be an array');
  v.ok(formulasRaw.length > 0, 'formulas must be non-empty');
  v.ok(
    formulasRaw.length <= MATCHMAKING_PAYLOAD_LIMITS.maxFormulas,
    `formulas must contain at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxFormulas)} entries`
  );
  const formulas: FormulaWire[] = [];
  for (let i = 0; i < formulasRaw.length; i += 1) {
    formulas.push(parseFormula(v, formulasRaw[i], `formulas[${String(i)}]`));
  }
  return { formulas };
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

const log = createLogger({ name: 'matchmaking-app' });

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

  // Post-join widen / narrow. Preserves `joined_at` so the participant
  // keeps their queue position. 404 when the participant is no longer
  // in matchmaking_waiting (matched, swept, or unknown id).
  app.post('/update-formulas/:participantId', async (c) => {
    const participantId = c.req.param('participantId');
    const raw: unknown = await c.req.json();
    const body = parseUpdateFormulasBody(raw);
    const result = await matchmaker.updateFormulasRaw(participantId, body);
    if (!result.updated) return c.json({ error: 'not found' }, 404);
    return c.json(result);
  });

  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      // Validation messages are deliberately consumer-visible: they're
      // 400s that describe exactly what's wrong with the body. The
      // validator owns the message contract.
      return c.json({ error: err.message }, 400);
    }
    // Anything else is an internal failure. Log full detail with a
    // route tag, return a flat opaque body — never echo the raw error
    // message to the client (it can leak SQL fragments, stack hints,
    // bind values, etc.). Clients that need richer signal should poll
    // `/status` or rely on their own request-id correlation.
    const message = err instanceof Error ? err.message : String(err);
    log.error('matchmaking app: internal error', {
      message,
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}
