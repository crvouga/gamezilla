import type { PropertyCatalog, PropertyDef } from './property';

export type PropertyCoverage = {
  readonly sometimes: ReadonlyMap<string, number>;
  readonly eventuallyPending: ReadonlyMap<string, boolean>;
};

export function createPropertyRunner<S>(catalog: PropertyCatalog<S>) {
  const sometimesHits = new Map<string, number>();
  const eventuallySeen = new Map<string, boolean>();
  const eventuallyMet = new Map<string, boolean>();

  for (const [id, def] of Object.entries(catalog)) {
    if (def.kind === 'eventually') {
      eventuallySeen.set(id, false);
      eventuallyMet.set(id, false);
    }
  }

  async function runAt(surface: S, at: 'step' | 'converge'): Promise<void> {
    for (const [id, def] of Object.entries(catalog)) {
      await checkOne(surface, id, def, at);
    }
  }

  async function checkOne(
    surface: S,
    id: string,
    def: PropertyDef<S>,
    at: 'step' | 'converge'
  ): Promise<void> {
    const ok = Boolean(await def.check(surface));
    if (def.kind === 'always') {
      if (def.at !== at) return;
      if (!ok) {
        throw new Error(`property.always(${id}): failed at ${at}`);
      }
      return;
    }
    if (def.kind === 'sometimes') {
      if (ok) {
        sometimesHits.set(id, (sometimesHits.get(id) ?? 0) + 1);
      }
      return;
    }
    if (def.kind === 'eventually') {
      eventuallySeen.set(id, true);
      if (ok) eventuallyMet.set(id, true);
    }
  }

  async function finalizeEventually(surface: S): Promise<void> {
    for (const [id, def] of Object.entries(catalog)) {
      if (def.kind !== 'eventually') continue;
      const ok = Boolean(await def.check(surface));
      if (ok) eventuallyMet.set(id, true);
      if (!eventuallyMet.get(id)) {
        throw new Error(`property.eventually(${id}): never true by converge`);
      }
    }
  }

  function coverage(): PropertyCoverage {
    return {
      sometimes: new Map(sometimesHits),
      eventuallyPending: new Map(
        [...eventuallyMet.entries()].filter(([, met]) => !met)
      ),
    };
  }

  function mergeCoverage(other: PropertyCoverage): void {
    for (const [id, n] of other.sometimes) {
      sometimesHits.set(id, (sometimesHits.get(id) ?? 0) + n);
    }
  }

  return {
    runAt,
    finalizeEventually,
    coverage,
    mergeCoverage,
    sometimesHits,
  };
}

export type PropertyRunner<S> = ReturnType<typeof createPropertyRunner<S>>;
