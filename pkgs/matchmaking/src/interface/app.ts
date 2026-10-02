/**
 * Shared HTTP surface for any {@link Matchmaking} adapter.
 *
 * Routes call port methods only — never SQL or adapter internals.
 * Body validation uses `Assert.validation()` so failures throw
 * `ValidationError` and map to HTTP 400.
 */

import { Assert, ValidationError } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import { assertKeywordRecord } from '@pkgs/keyword';
import { createLogger } from '@pkgs/logger';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import type {
  CategoricalTermWire,
  FormulaWire,
  NumericTermWire,
  PartitionTermWire,
  RadiusOptionsWire,
} from './formula-wire';
import type { JoinInputRaw, Matchmaking } from './matchmaking';
import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_PAYLOAD_LIMITS,
} from './payload-limits';

type LeaveBody = { readonly participantId: string; readonly requestId: string };

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
  const radius = parseRadius(v, raw['radius'], label);
  return {
    numeric,
    categorical,
    partition,
    ...(radius === undefined ? {} : { radius }),
  };
}

function parseRadius(
  v: Assert,
  raw: unknown,
  label: string
): RadiusOptionsWire | undefined {
  if (raw === undefined) return undefined;
  v.record(raw, `${label}.radius must be an object`);
  const base = raw['baseRadius'];
  const growth = raw['radiusGrowthPerSecond'];
  const max = raw['maxRadius'];
  v.ok(
    typeof base === 'number' && Number.isFinite(base) && base >= 0,
    `${label}.radius.baseRadius must be finite and non-negative`
  );
  v.ok(
    typeof growth === 'number' && Number.isFinite(growth) && growth >= 0,
    `${label}.radius.radiusGrowthPerSecond must be finite and non-negative`
  );
  v.ok(
    typeof max === 'number' && Number.isFinite(max) && max >= base,
    `${label}.radius.maxRadius must be finite and at least baseRadius`
  );
  return { baseRadius: base, radiusGrowthPerSecond: growth, maxRadius: max };
}

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

function parseJoinBody(raw: unknown): Omit<JoinInputRaw, 'ownerId'> {
  const v: Assert = Assert.validation();
  v.record(raw, 'body must be a JSON object');
  const data = parseJoinData(v, raw['data']);
  const formulas = parseJoinFormulas(v, raw['formulas']);
  const groupSize = parseOptionalBoundedInt(v, raw['groupSize'], {
    field: 'groupSize',
    min: MATCHMAKING_MIN_GROUP_SIZE,
    max: MATCHMAKING_MAX_GROUP_SIZE,
  });
  const metadata = parseOptionalMetadata(v, raw['metadata']);
  return {
    requestId: parseRequestId(v, raw),
    data,
    formulas,
    ...(groupSize !== undefined ? { groupSize } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

function parseUpdateFormulasBody(raw: unknown): {
  readonly formulas: readonly FormulaWire[];
  readonly requestId: string;
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
  return { formulas, requestId: parseRequestId(v, raw) };
}

function parseLeaveBody(raw: unknown): LeaveBody {
  const v: Assert = Assert.validation();
  v.record(raw, 'body must be a JSON object');
  const participantId: unknown = raw['participantId'];
  v.nonEmptyString(participantId, 'participantId must be a non-empty string');
  return { participantId, requestId: parseRequestId(v, raw) };
}

function parseRequestId(v: Assert, raw: Record<string, unknown>): string {
  const requestId = raw['requestId'];
  v.nonEmptyString(requestId, 'requestId must be a non-empty string');
  assertStringByteCap(v, requestId, 'requestId');
  return requestId;
}

export type CreateMatchmakingAppOptions = {
  readonly matchmaking: Matchmaking;
  readonly requireAuth: MiddlewareHandler;
  readonly ownerId: (context: Context) => string;
  /** Epoch ms — required for error logging (no wall fallback). */
  readonly now: () => number;
};

export function createMatchmakingApp(opts: CreateMatchmakingAppOptions): Hono {
  const { matchmaking, requireAuth, now } = opts;
  const log = createLogger({ name: 'matchmaking-app', now });
  const app = new Hono();
  app.use('*', requireAuth);

  app.post('/join', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseJoinBody(raw);
    const result = await matchmaking.joinRaw({
      ...body,
      ownerId: opts.ownerId(c),
    });
    return c.json(result);
  });

  app.post('/leave', async (c) => {
    const raw: unknown = await c.req.json();
    const body = parseLeaveBody(raw);
    const result = await matchmaking.leave({
      ...body,
      ownerId: opts.ownerId(c),
    });
    return c.json(result);
  });

  app.get('/status/:participantId', async (c) => {
    const participantId = c.req.param('participantId');
    const result = await matchmaking.status(opts.ownerId(c), participantId);
    if (result === null) return c.json({ error: 'not found' }, 404);
    c.header('Cache-Control', 'private, no-store');
    return c.json(result);
  });

  app.post('/update-formulas/:participantId', async (c) => {
    const participantId = c.req.param('participantId');
    const raw: unknown = await c.req.json();
    const body = parseUpdateFormulasBody(raw);
    const result = await matchmaking.updateFormulasRaw(
      { ownerId: opts.ownerId(c), participantId, requestId: body.requestId },
      body
    );
    if (!result.updated) return c.json({ error: 'not found' }, 404);
    return c.json(result);
  });

  /**
   * Runtime-driven match pass + sweep. Stateless workers may call this
   * concurrently; correctness uses transactional pool and owner locks.
   */
  app.post('/tick', async (c) => {
    const result = await matchmaking.tick();
    return c.json(result);
  });

  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
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
