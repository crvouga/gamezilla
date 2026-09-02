import {
  assertJsonValue,
  canonicalJsonStringify,
  isPlainObject,
  type JsonValue,
} from '../kernel/json';
import type { TraceRecord } from '../kernel/trace';
import type { NetworkFaults } from '../models/network';

/** Everything needed to re-run one World execution: seed + knobs + Actions. */
export type ReproInputs<
  A extends JsonValue = JsonValue,
  K extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly seed?: string;
  readonly startTime: number;
  readonly knobs: K;
  readonly actions: readonly A[];
  readonly networkFaults: NetworkFaults;
  readonly swarm?: readonly string[];
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

export const REPRO_VERSION = 3 as const;

export type Repro<
  A extends JsonValue = JsonValue,
  K extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly version: typeof REPRO_VERSION;
  readonly inputs: ReproInputs<A, K>;
  readonly meta: ReproMeta;
};

export type Example = {
  readonly name: string;
  readonly inputs: ReproInputs;
};

export type FailureReport = {
  readonly repro: Repro;
  readonly trace: readonly TraceRecord[];
  readonly error: string;
  readonly coverage?: CoverageReport;
};

export type CoverageReport = {
  readonly properties: Readonly<Record<string, number>>;
  readonly invariants: Readonly<Record<string, number>>;
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
  if (r.inputs.seed !== undefined) {
    assertJsonValue(r.inputs.seed, 'inputs.seed');
  }
  assertJsonValue(r.inputs.startTime, 'inputs.startTime');
  assertJsonValue(r.inputs.knobs, 'inputs.knobs');
  assertJsonValue(r.inputs.actions as JsonValue, 'inputs.actions');
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
  const inputs: Record<string, JsonValue> = {
    startTime: r.inputs.startTime,
    knobs: r.inputs.knobs,
    actions: r.inputs.actions as JsonValue,
    networkFaults: r.inputs.networkFaults as unknown as JsonValue,
  };
  if (r.inputs.seed !== undefined) inputs['seed'] = r.inputs.seed;
  if (r.inputs.swarm !== undefined)
    inputs['swarm'] = r.inputs.swarm as JsonValue;
  const body: JsonValue = {
    version: REPRO_VERSION,
    inputs,
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
  const version = raw['version'];
  if (version !== REPRO_VERSION) {
    throw new Error(
      `Repro: unsupported version ${String(version)} (expected ${REPRO_VERSION})`
    );
  }
  return raw;
}

function parseInputs(inputs: unknown): ReproInputs {
  if (!isPlainObject(inputs)) {
    throw new Error('Repro: inputs must be object');
  }
  for (const req of [
    'startTime',
    'knobs',
    'actions',
    'networkFaults',
  ] as const) {
    if (!(req in inputs)) {
      throw new Error(`Repro: missing inputs.${req}`);
    }
  }
  const seedRaw = inputs['seed'];
  const seed =
    seedRaw === undefined
      ? undefined
      : typeof seedRaw === 'string'
        ? seedRaw
        : (() => {
            throw new Error('Repro: inputs.seed must be string when present');
          })();
  const startTime = inputs['startTime'];
  if (typeof startTime !== 'number' || !Number.isFinite(startTime)) {
    throw new Error('Repro: inputs.startTime must be finite number');
  }
  const knobs = assertJsonValue(inputs['knobs'], 'inputs.knobs');
  if (!isPlainObject(knobs)) {
    throw new Error('Repro: inputs.knobs must be object');
  }
  const actions = assertJsonValue(inputs['actions'], 'inputs.actions');
  if (!Array.isArray(actions)) {
    throw new Error('Repro: inputs.actions must be array');
  }
  const swarmRaw = inputs['swarm'];
  let swarm: readonly string[] | undefined;
  if (swarmRaw !== undefined) {
    if (
      !Array.isArray(swarmRaw) ||
      !swarmRaw.every((x) => typeof x === 'string')
    ) {
      throw new Error('Repro: inputs.swarm must be string[]');
    }
    swarm = swarmRaw as string[];
  }
  return {
    ...(seed !== undefined ? { seed } : {}),
    startTime,
    knobs: knobs as Record<string, JsonValue>,
    actions: actions as JsonValue[],
    networkFaults: parseFaults(inputs['networkFaults'], 'inputs.networkFaults'),
    ...(swarm !== undefined ? { swarm } : {}),
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
