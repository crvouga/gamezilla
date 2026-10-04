import { daysPass, declare, indexTuningSystem, keepOwnIndex, retiringLookups, teamIndexKept, tune, tunedLookups, use, usesByLookup } from '@pkgs/db-indexes-harness/index-tuning-system';
import type { IndexTuning, Lookup } from '@pkgs/db-indexes-harness/index-tuning-system';
import type { Run } from '@pkgs/harness-shared/run-types';
import type { QuintBinding, QuintWorld } from '@pkgs/quint-shared/registry';

type World = Run<IndexTuning>;
const FIELD_LOOKUP: Readonly<Record<string, Lookup>> = {
  user_id: 'notesByAuthor',
  owner_id: 'notesByOwner',
};

export const retirementWorld: QuintWorld<World> = {
  create: () => indexTuningSystem.run({ seed: 424242 }),
  dispose: (world) => world[Symbol.asyncDispose](),
};

export const retirementBinding: QuintBinding<World> = {
  model: 'index-retirement',
  traces: 80,
  maxSteps: 25,
  verifySteps: 7,
  actions: {
    init: async () => {},
    declare: (world, picks) =>
      world.apply(
        declare,
        [...(picks['wanted'] as ReadonlySet<Lookup>)].sort()
      ),
    tune: (world) => world.apply(tune),
    use: (world, picks) => world.apply(use, picks['lookup'] as Lookup),
    daysPass: (world, picks) => world.apply(daysPass, Number(picks['days'])),
    keepOwnIndex: (world) => world.apply(keepOwnIndex),
  },
  observe: async (world) => {
    const indexes = await world.read((s) => s.tuner.db.introspectIndexes());
    const metas = await world.read((s) => s.tuner.db.readOwnedMeta());
    const windowStart = new Map<string, number>();
    const baseline = new Map<string, number>();
    for (const meta of metas) {
      if (meta.deprecatedAt === null) continue;
      const index = indexes.find((ix) => ix.name === meta.name)!;
      const lookup = FIELD_LOOKUP[index.columns[0]!]!;
      windowStart.set(lookup, meta.deprecatedAt / 86_400_000);
      baseline.set(lookup, meta.usageAtDeprecation!);
    }
    return {
      declared: new Set(
        await world.read((s) => s.tuner.manifest.queries.map((q) => q.name))
      ),
      indexed: new Set(await world.read(tunedLookups)),
      retiring: new Set(await world.read(retiringLookups)),
      uses: await world.read(usesByLookup),
      day: await world.read((s) => s.tuner.clock.now() / 86_400_000),
      teamIndex: await world.read(teamIndexKept),
      windowStart,
      baseline,
    };
  },
  fingerprint: (world) =>
    world.read(async (s) =>
      JSON.stringify({
        indexes: await s.tuner.db.introspectIndexes(),
        metas: await s.tuner.db.readOwnedMeta(),
        usage: await s.tuner.db.readIndexUsage(),
        manifest: s.tuner.manifest,
        time: s.tuner.clock.now(),
      })
    ),
};
