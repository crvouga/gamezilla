/**
 * `specs/index-tuning/index-tuning.qnt` against the tuning harness: each model
 * action through the harness's actions, and the model's state read back from
 * the tuned indexes, their retirement, their uses and the team's own index.
 * The standing tuning invariants run after every step.
 */

import {
  daysPass,
  declare,
  indexTuningSystem,
  keepOwnIndex,
  type Lookup,
  retiringLookups,
  teamIndexKept,
  tune,
  tunedIndexNames,
  tunedLookups,
  use,
  usesByLookup,
} from '@pkgs/db-indexes/harness';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import { type TuningTraceWorld, traceTuning } from './world';

const TAGS: Readonly<Record<Lookup, string>> = {
  notesByAuthor: 'NotesByAuthor',
  notesByOwner: 'NotesByOwner',
};

function lookupOf(value: QuintValue): Lookup {
  const tag = (value as { readonly tag: string }).tag;
  const lookup = (Object.keys(TAGS) as Lookup[]).find((l) => TAGS[l] === tag);
  if (lookup === undefined) throw new Error(`unknown lookup ${tag}`);
  return lookup;
}

function asVariant(lookup: Lookup): QuintValue {
  return variant(TAGS[lookup]);
}

function lookupsPicked(picks: Picks): Lookup[] {
  return [...(picks['lookups'] as ReadonlySet<QuintValue>)]
    .map(lookupOf)
    .sort();
}

bindQuintModel<TuningTraceWorld>({
  model: 'index-tuning',
  traces: 128,
  maxSteps: 20,
  actions: {
    init: async (w) => {
      w.harness = await indexTuningSystem.run({ seed: w.ctx.testId });
    },
    declare: async (w, picks) => {
      await traceTuning(w).apply(declare, lookupsPicked(picks));
    },
    tune: async (w) => {
      await traceTuning(w).apply(tune);
    },
    use: async (w, picks) => {
      await traceTuning(w).apply(use, lookupOf(picks['lookup']!));
    },
    daysPass: async (w, picks) => {
      await traceTuning(w).apply(daysPass, Number(picks['days']));
    },
    keepOwnIndex: async (w) => {
      await traceTuning(w).apply(keepOwnIndex);
    },
  },
  observe: async (w) => {
    const s = traceTuning(w);
    const uses = await s.read(usesByLookup);
    return {
      tuned: new Set((await s.read(tunedLookups)).map(asVariant)),
      retiring: new Set((await s.read(retiringLookups)).map(asVariant)),
      uses: new Map([...uses].map(([l, n]) => [asVariant(l), n])),
      teamIndex: await s.read(teamIndexKept),
    };
  },
  fingerprint: async (w) =>
    JSON.stringify(await traceTuning(w).read(tunedIndexNames)),
});
