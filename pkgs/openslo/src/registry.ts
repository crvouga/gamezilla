/**
 * How a package measures the indicators of its objective files: one binding
 * per `specs/<context>/<stem>.openslo.yaml`, naming a measure per SLI
 * (`metadata.name`). A measure is the product adapter — a harness run at
 * check time, live telemetry or synthetics at release time. Module-global,
 * like the Quint registry, filled by the `tests/openslo/**` modules a
 * package's openslo entry (`tests/openslo/index.ts`) imports.
 */

import type { Measurement } from './evaluate';

/** What a measure is asked for: the window of the SLO it is measured for. */
export type MeasureContext = {
  /**
   * The evaluation moment. Without an injected clock (`nowMs` on the
   * binding) the window is unbounded (`-Infinity`..`Infinity`) and the
   * moment is the latest `atMs` the measure returns.
   */
  readonly nowMs: number;
  /** Inclusive window start. */
  readonly startMs: number;
  /** Inclusive window end. */
  readonly endMs: number;
};

export type Measure = (context: MeasureContext) => Promise<Measurement>;

export type ObjectivesLayer = 'implementation' | 'release';

export type ObjectivesBinding = {
  /** The objective file this binds: its stem (`note-delivery`). */
  readonly spec: string;
  /** Where the verdicts are reported. Default `implementation`. */
  readonly layer?: ObjectivesLayer;
  /** One measure per SLI the file's SLOs use, by `metadata.name`. */
  readonly measure: Readonly<Record<string, Measure>>;
  /** The evaluation moment. Default: the latest `atMs` measured. */
  readonly nowMs?: () => number;
  /** Per-objective test timeout (a harness-run measure can be slow). Default: the runner's. */
  readonly timeoutMs?: number;
};

type Registry = { readonly bindings: Map<string, ObjectivesBinding> };

const REGISTRY_KEY = Symbol.for('openslo.registry');

function registry(): Registry {
  const host = globalThis as { [REGISTRY_KEY]?: Registry };
  host[REGISTRY_KEY] ??= { bindings: new Map() };
  return host[REGISTRY_KEY];
}

export function bindObjectives(binding: ObjectivesBinding): void {
  const bindings = registry().bindings;
  if (bindings.has(binding.spec)) {
    throw new Error(`openslo: objectives ${binding.spec} are bound twice`);
  }
  bindings.set(binding.spec, binding);
}

export function objectivesBinding(spec: string): ObjectivesBinding {
  const binding = registry().bindings.get(spec);
  if (binding === undefined) {
    throw new Error(
      `openslo: objectives ${spec} have no binding — add tests/openslo/${spec}.binding.ts with bindObjectives({ spec: '${spec}', measure: { … } }) and import it from tests/openslo/index.ts`
    );
  }
  return binding;
}

/** `specs/sync-engine/note-delivery.openslo.yaml` → `note-delivery`. */
export function objectiveSpecStem(specPath: string): string {
  const file = specPath.split(/[\\/]/).at(-1) ?? specPath;
  return file.replace(/\.openslo\.ya?ml$/, '');
}
