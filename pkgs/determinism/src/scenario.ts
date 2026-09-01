import {
  assertJsonValue,
  canonicalJsonStringify,
  isPlainObject,
  type JsonValue,
} from './json';
import type { SimNetFaultProfile } from './network';
import type { TraceRecord } from './trace';

export type SimScenarioInputs<
  A extends JsonValue = JsonValue,
  K extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly seed: string;
  readonly startMs: number;
  readonly knobs: K;
  readonly actions: readonly A[];
  readonly networkDefaults: SimNetFaultProfile;
};

export type SimScenarioMeta = {
  readonly appId?: string;
  readonly fcSeed?: number;
  readonly replayPath?: string;
  readonly failureStep?: number;
  readonly error?: string;
  readonly seedHex?: string;
  readonly [k: string]: JsonValue | undefined;
};

export type SimScenario<
  A extends JsonValue = JsonValue,
  K extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly version: 1;
  readonly inputs: SimScenarioInputs<A, K>;
  readonly meta: SimScenarioMeta;
};

export type SimFailureArtifact = {
  readonly scenario: SimScenario;
  readonly trace: readonly TraceRecord[];
  readonly error: string;
};

const PROFILE_KEYS = [
  'oneWayDelayMeanMs',
  'oneWayDelayJitterMs',
  'packetLossProbability',
  'duplicateProbability',
  'reorderWindowMs',
  'partitionProbability',
  'unpartitionProbability',
] as const;

function parseProfile(value: unknown, path: string): SimNetFaultProfile {
  if (!isPlainObject(value)) {
    throw new Error(`SimScenario: ${path} must be object`);
  }
  const out: Record<string, number> = {};
  for (const k of PROFILE_KEYS) {
    const v = value[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`SimScenario: ${path}.${k} must be finite number`);
    }
    out[k] = v;
  }
  return out as unknown as SimNetFaultProfile;
}

export function captureScenario(s: SimScenario): string {
  assertJsonValue(s.inputs.seed, 'inputs.seed');
  assertJsonValue(s.inputs.startMs, 'inputs.startMs');
  assertJsonValue(s.inputs.knobs, 'inputs.knobs');
  assertJsonValue(s.inputs.actions as JsonValue, 'inputs.actions');
  assertJsonValue(
    s.inputs.networkDefaults as unknown as JsonValue,
    'inputs.networkDefaults'
  );
  const metaJson = assertJsonValue(
    Object.fromEntries(
      Object.entries(s.meta).filter(([, v]) => v !== undefined)
    ),
    'meta'
  );
  const body: JsonValue = {
    version: 1,
    inputs: {
      seed: s.inputs.seed,
      startMs: s.inputs.startMs,
      knobs: s.inputs.knobs,
      actions: s.inputs.actions as JsonValue,
      networkDefaults: s.inputs.networkDefaults as unknown as JsonValue,
    },
    meta: metaJson,
  };
  return canonicalJsonStringify(body);
}

export function parseScenario(json: string): SimScenario {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(
      `SimScenario: invalid JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (!isPlainObject(raw)) {
    throw new Error('SimScenario: root must be object');
  }
  for (const k of Object.keys(raw)) {
    if (k !== 'version' && k !== 'inputs' && k !== 'meta') {
      throw new Error(`SimScenario: unknown top-level key ${k}`);
    }
  }
  if (raw['version'] !== 1) {
    throw new Error(
      `SimScenario: unsupported version ${String(raw['version'])}`
    );
  }
  if (!isPlainObject(raw['inputs'])) {
    throw new Error('SimScenario: inputs must be object');
  }
  const inputs = raw['inputs'];
  for (const req of [
    'seed',
    'startMs',
    'knobs',
    'actions',
    'networkDefaults',
  ] as const) {
    if (!(req in inputs)) {
      throw new Error(`SimScenario: missing inputs.${req}`);
    }
  }
  if (typeof inputs['seed'] !== 'string') {
    throw new Error('SimScenario: inputs.seed must be string');
  }
  if (
    typeof inputs['startMs'] !== 'number' ||
    !Number.isFinite(inputs['startMs'])
  ) {
    throw new Error('SimScenario: inputs.startMs must be finite number');
  }
  const knobs = assertJsonValue(inputs['knobs'], 'inputs.knobs');
  if (!isPlainObject(knobs)) {
    throw new Error('SimScenario: inputs.knobs must be object');
  }
  const actions = assertJsonValue(inputs['actions'], 'inputs.actions');
  if (!Array.isArray(actions)) {
    throw new Error('SimScenario: inputs.actions must be array');
  }
  const networkDefaults = parseProfile(
    inputs['networkDefaults'],
    'inputs.networkDefaults'
  );
  const metaRaw = raw['meta'] ?? {};
  if (!isPlainObject(metaRaw)) {
    throw new Error('SimScenario: meta must be object');
  }
  const meta = assertJsonValue(metaRaw, 'meta') as SimScenarioMeta;
  return {
    version: 1,
    inputs: {
      seed: inputs['seed'],
      startMs: inputs['startMs'],
      knobs: knobs as Record<string, JsonValue>,
      actions: actions as JsonValue[],
      networkDefaults,
    },
    meta,
  };
}
