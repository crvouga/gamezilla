import {
  assertJsonValue,
  canonicalJsonStringify,
  isPlainObject,
  type JsonValue,
} from '../kernel/json';
import type { TraceRecord } from '../kernel/trace';
import type { NetworkFaults } from '../models/network';

/** Everything needed to re-run one World execution: seed + knobs + Commands. */
export type ReproInputs<
  C extends JsonValue = JsonValue,
  K extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly seed: string;
  readonly startTime: number;
  readonly knobs: K;
  readonly commands: readonly C[];
  readonly networkFaults: NetworkFaults;
};

export type ReproMeta = {
  readonly scenarioId?: string;
  readonly fcSeed?: number;
  readonly replayPath?: string;
  readonly failureStep?: number;
  readonly error?: string;
  readonly seedHex?: string;
  readonly [k: string]: JsonValue | undefined;
};

export const REPRO_VERSION = 2 as const;

/**
 * A serialized, reproducible input instance (schema v2). Older versions are
 * rejected loudly by `parseRepro`.
 */
export type Repro<
  C extends JsonValue = JsonValue,
  K extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly version: typeof REPRO_VERSION;
  readonly inputs: ReproInputs<C, K>;
  readonly meta: ReproMeta;
};

/**
 * What a failing run leaves behind.
 * TODO(dst-audit): add `firstDivergentStep` and minimal repro in Phase 4.
 */
export type FailureReport = {
  readonly repro: Repro;
  readonly trace: readonly TraceRecord[];
  readonly error: string;
};

const FAULT_KEYS = [
  'latencyMeanMs',
  'latencyJitterMs',
  'dropProbability',
  'duplicateProbability',
  'reorderWindowMs',
  'partitionProbability',
  'healProbability',
] as const;

function parseFaults(value: unknown, path: string): NetworkFaults {
  if (!isPlainObject(value)) {
    throw new Error(`Repro: ${path} must be object`);
  }
  const out: Record<string, number> = {};
  for (const k of FAULT_KEYS) {
    const v = value[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Repro: ${path}.${k} must be finite number`);
    }
    out[k] = v;
  }
  return out as unknown as NetworkFaults;
}

export function stringifyRepro(r: Repro): string {
  assertJsonValue(r.inputs.seed, 'inputs.seed');
  assertJsonValue(r.inputs.startTime, 'inputs.startTime');
  assertJsonValue(r.inputs.knobs, 'inputs.knobs');
  assertJsonValue(r.inputs.commands as JsonValue, 'inputs.commands');
  assertJsonValue(
    r.inputs.networkFaults as unknown as JsonValue,
    'inputs.networkFaults'
  );
  const metaJson = assertJsonValue(
    Object.fromEntries(
      Object.entries(r.meta).filter(([, v]) => v !== undefined)
    ),
    'meta'
  );
  const body: JsonValue = {
    version: REPRO_VERSION,
    inputs: {
      seed: r.inputs.seed,
      startTime: r.inputs.startTime,
      knobs: r.inputs.knobs,
      commands: r.inputs.commands as JsonValue,
      networkFaults: r.inputs.networkFaults as unknown as JsonValue,
    },
    meta: metaJson,
  };
  return canonicalJsonStringify(body);
}

function parseRoot(json: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Repro: invalid JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (!isPlainObject(raw)) {
    throw new Error('Repro: root must be object');
  }
  for (const k of Object.keys(raw)) {
    if (k !== 'version' && k !== 'inputs' && k !== 'meta') {
      throw new Error(`Repro: unknown top-level key ${k}`);
    }
  }
  if (raw['version'] !== REPRO_VERSION) {
    throw new Error(
      `Repro: unsupported version ${String(raw['version'])} (expected ${REPRO_VERSION})`
    );
  }
  return raw;
}

function parseInputs(inputs: unknown): ReproInputs {
  if (!isPlainObject(inputs)) {
    throw new Error('Repro: inputs must be object');
  }
  for (const req of [
    'seed',
    'startTime',
    'knobs',
    'commands',
    'networkFaults',
  ] as const) {
    if (!(req in inputs)) {
      throw new Error(`Repro: missing inputs.${req}`);
    }
  }
  const seed = inputs['seed'];
  if (typeof seed !== 'string') {
    throw new Error('Repro: inputs.seed must be string');
  }
  const startTime = inputs['startTime'];
  if (typeof startTime !== 'number' || !Number.isFinite(startTime)) {
    throw new Error('Repro: inputs.startTime must be finite number');
  }
  const knobs = assertJsonValue(inputs['knobs'], 'inputs.knobs');
  if (!isPlainObject(knobs)) {
    throw new Error('Repro: inputs.knobs must be object');
  }
  const commands = assertJsonValue(inputs['commands'], 'inputs.commands');
  if (!Array.isArray(commands)) {
    throw new Error('Repro: inputs.commands must be array');
  }
  return {
    seed,
    startTime,
    knobs: knobs as Record<string, JsonValue>,
    commands: commands as JsonValue[],
    networkFaults: parseFaults(inputs['networkFaults'], 'inputs.networkFaults'),
  };
}

export function parseRepro(json: string): Repro {
  const raw = parseRoot(json);
  const inputs = parseInputs(raw['inputs']);
  const metaRaw = raw['meta'] ?? {};
  if (!isPlainObject(metaRaw)) {
    throw new Error('Repro: meta must be object');
  }
  const meta = assertJsonValue(metaRaw, 'meta') as ReproMeta;
  return { version: REPRO_VERSION, inputs, meta };
}
