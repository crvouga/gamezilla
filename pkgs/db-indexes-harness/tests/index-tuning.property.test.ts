/**
 * Model-based test of index tuning: generated sequences of declaring lookups,
 * tuning runs, lookups using their tuned index, days passing and the team
 * adding an index of its own, run against the tuning harness
 * (`indexTuningSystem`, whose `tuningInvariantsHold` property is checked
 * after every action) and against the reference model below. After every
 * step the two must agree on which lookups have a tuned index, which of
 * those are retiring, how many times each has been used, and whether the
 * team's own index is there; a tuning run must change something exactly when
 * the model says it changes which indexes there are or which are retiring.
 * The model's invariants hold after every step, and the same sequence
 * replayed on a fresh harness ends in the same state (indexes, retirement
 * bookkeeping, use counts and the last tuning report).
 *
 * Complementary generated reference-model agreement checks. The executable
 * specification lives in specs/db-indexes and is replayed by tests/quint.
 *
 * The rules the model states:
 * - every declared lookup gets a tuned index when tuning runs;
 * - tuning again with nothing new to do changes nothing;
 * - a tuned index no declared lookup needs starts retiring and stays;
 * - a retiring index unused for a whole retirement window is removed;
 * - declaring its lookup again stops an index retiring;
 * - a retiring index used during its window is kept (its window restarts);
 * - tuning never touches the team's own index, however long it goes unused.
 */
import { describe, expect, test } from 'bun:test';
import type {
  IndexTuning,
  Lookup,
} from '@pkgs/db-indexes-harness/index-tuning-system';
import {
  daysPass,
  declare,
  indexTuningSystem,
  keepOwnIndex,
  LOOKUPS,
  lastTuningChanges,
  retiringLookups,
  TUNING_CONFIG,
  teamIndexKept,
  tune,
  tunedLookups,
  use,
  usesByLookup,
} from '@pkgs/db-indexes-harness/index-tuning-system';
import type { Run } from '@pkgs/harness-shared/run-types';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

/** How long a retiring index must go unused before tuning removes it. */
const RETIREMENT_WINDOW_DAYS = 1;
/** Days passing at once: less than a window, one, and many. */
const DAYS = [1, 2, 40] as const;

type Command =
  | { readonly kind: 'declare'; readonly lookups: readonly Lookup[] }
  | { readonly kind: 'tune' }
  | { readonly kind: 'use'; readonly lookup: Lookup }
  | { readonly kind: 'daysPass'; readonly days: number }
  | { readonly kind: 'keepOwnIndex' };

/** The reference model: index tuning as the team sees it. */
type Model = {
  declared: Set<Lookup>;
  tuned: Set<Lookup>;
  retiring: Set<Lookup>;
  uses: Map<Lookup, number>;
  teamIndex: boolean;
  today: number;
  /** The day each retiring index's retirement window began. */
  windowStart: Map<Lookup, number>;
  /** How many times each retiring index had been used when its window began. */
  usesAtWindowStart: Map<Lookup, number>;
};

function initialModel(): Model {
  return {
    declared: new Set(),
    tuned: new Set(),
    retiring: new Set(),
    uses: new Map(),
    teamIndex: false,
    today: 0,
    windowStart: new Map(),
    usesAtWindowStart: new Map(),
  };
}

function sorted(set: Iterable<Lookup>): Lookup[] {
  return [...set].sort();
}

/**
 * One tuning run on the model; returns whether it changed which lookups have
 * a tuned index or which of those are retiring (restarting a retirement
 * window is bookkeeping, not a change the team sees).
 */
function modelTune(m: Model): boolean {
  const usesOf = (l: Lookup) => m.uses.get(l) ?? 0;
  const usedSince = sorted(m.retiring).filter(
    (l) => usesOf(l) > (m.usesAtWindowStart.get(l) ?? 0)
  );
  const added = sorted(m.declared).filter((l) => !m.tuned.has(l));
  const startsRetiring = sorted(m.tuned).filter(
    (l) => !(m.declared.has(l) || m.retiring.has(l))
  );
  const removed = sorted(m.retiring).filter(
    (l) =>
      !(m.declared.has(l) || usedSince.includes(l)) &&
      m.today - (m.windowStart.get(l) ?? 0) >= RETIREMENT_WINDOW_DAYS
  );
  const stillRetiring = new Set([
    ...sorted(m.retiring).filter(
      (l) => !(m.declared.has(l) || removed.includes(l))
    ),
    ...startsRetiring,
  ]);
  const restarts = new Set([...startsRetiring, ...usedSince]);
  const before = JSON.stringify(snapshotOf(m));
  const tuned = new Set([...m.tuned, ...added]);
  for (const l of removed) tuned.delete(l);
  const windowStart = new Map<Lookup, number>();
  const usesAtWindowStart = new Map<Lookup, number>();
  for (const l of stillRetiring) {
    const restart = restarts.has(l);
    windowStart.set(l, restart ? m.today : (m.windowStart.get(l) ?? 0));
    usesAtWindowStart.set(
      l,
      restart ? usesOf(l) : (m.usesAtWindowStart.get(l) ?? 0)
    );
  }
  m.tuned = tuned;
  m.retiring = stillRetiring;
  m.uses = new Map(
    sorted(tuned).map((l) => [l, added.includes(l) ? 0 : usesOf(l)])
  );
  m.windowStart = windowStart;
  m.usesAtWindowStart = usesAtWindowStart;
  return JSON.stringify(snapshotOf(m)) !== before;
}

/** The indexes and retirements a tuning run can change. */
function snapshotOf(m: Model) {
  return { tuned: sorted(m.tuned), retiring: sorted(m.retiring) };
}

/** The model's standing invariants, after every step. */
function expectModelInvariants(m: Model): void {
  // Only a tuned index retires.
  for (const l of m.retiring) expect(m.tuned.has(l)).toBe(true);
  // The team sees a use count for every tuned index and no other.
  expect(sorted(m.uses.keys())).toEqual(sorted(m.tuned));
  // Every retiring index has a retirement window that has already begun.
  for (const l of m.retiring) {
    const start = m.windowStart.get(l);
    expect(start).toBeDefined();
    expect(start!).toBeLessThanOrEqual(m.today);
    expect(m.uses.get(l)!).toBeGreaterThanOrEqual(
      m.usesAtWindowStart.get(l) ?? 0
    );
  }
}

/** The harness's own view of each retiring index's window. */
async function retirementWindowsBegun(s: IndexTuning): Promise<boolean[]> {
  const now = s.tuner.clock.now();
  const metas = await s.tuner.db.readOwnedMeta();
  const usage = await s.tuner.db.readIndexUsage();
  return metas
    .filter((m) => m.deprecatedAt != null)
    .map(
      (m) =>
        m.deprecatedAt! <= now &&
        (usage.find((u) => u.name === m.name)?.scans ?? 0) >=
          (m.usageAtDeprecation ?? 0)
    );
}

/**
 * Whether `c` can run from the model's state: a lookup uses only its tuned
 * index, and the team adds its own index once.
 */
function enabled(m: Model, c: Command): boolean {
  if (c.kind === 'use') return m.tuned.has(c.lookup);
  if (c.kind === 'keepOwnIndex') return !m.teamIndex;
  return true;
}

async function applyBoth(
  m: Model,
  h: Run<IndexTuning>,
  c: Command
): Promise<void> {
  switch (c.kind) {
    case 'declare':
      m.declared = new Set(c.lookups);
      await h.apply(declare, c.lookups);
      return;
    case 'tune': {
      const changed = modelTune(m);
      await h.apply(tune);
      expect((await h.read(lastTuningChanges)) > 0).toBe(changed);
      return;
    }
    case 'use':
      m.uses.set(c.lookup, (m.uses.get(c.lookup) ?? 0) + 1);
      await h.apply(use, c.lookup);
      return;
    case 'daysPass':
      m.today += c.days;
      await h.apply(daysPass, c.days);
      return;
    case 'keepOwnIndex':
      m.teamIndex = true;
      await h.apply(keepOwnIndex);
      return;
  }
}

async function expectAgreement(m: Model, h: Run<IndexTuning>): Promise<void> {
  expect(await h.read(tunedLookups)).toEqual(sorted(m.tuned));
  expect(await h.read(retiringLookups)).toEqual(sorted(m.retiring));
  expect(Object.fromEntries(await h.read(usesByLookup))).toEqual(
    Object.fromEntries(m.uses)
  );
  expect(await h.read(teamIndexKept)).toBe(m.teamIndex);
  expect(await h.read(retirementWindowsBegun)).toEqual(
    sorted(m.retiring).map(() => true)
  );
}

/**
 * The harness's whole end state — every index, its retirement bookkeeping and
 * its use count — so two runs of the same sequence can be compared.
 */
async function fingerprint(s: IndexTuning): Promise<string> {
  return JSON.stringify({
    indexes: await s.tuner.db.introspectIndexes(),
    metas: await s.tuner.db.readOwnedMeta(),
    usage: await s.tuner.db.readIndexUsage(),
    lastReport: s.tuner.lastReport,
  });
}

/** Runs `commands` on a fresh harness and model; returns its end state. */
async function runCommands(
  commands: readonly Command[],
  seed: string
): Promise<string> {
  const m = initialModel();
  await using h = await indexTuningSystem.run({ seed });
  for (const c of commands) {
    if (!enabled(m, c)) continue;
    await applyBoth(m, h, c);
    await expectAgreement(m, h);
    expectModelInvariants(m);
  }
  return h.read(fingerprint);
}

const arbLookup = fc.constantFrom(...LOOKUPS);
const arbCommand: fc.Arbitrary<Command> = fc.oneof(
  {
    arbitrary: fc
      .subarray([...LOOKUPS])
      .map((lookups): Command => ({ kind: 'declare', lookups })),
    weight: 2,
  },
  { arbitrary: fc.constant<Command>({ kind: 'tune' }), weight: 3 },
  {
    arbitrary: arbLookup.map((lookup): Command => ({ kind: 'use', lookup })),
    weight: 2,
  },
  {
    arbitrary: fc
      .constantFrom(...DAYS)
      .map((days): Command => ({ kind: 'daysPass', days })),
    weight: 2,
  },
  { arbitrary: fc.constant<Command>({ kind: 'keepOwnIndex' }), weight: 1 }
);

describe('index tuning', () => {
  // Each run boots one harness and replays its sequence on a second; all 128
  // runs take ~0.3 s idle. The timeout leaves room for a loaded runner. 128
  // runs of 10-40 steps reach every rule on the pinned seed (retiring,
  // removal, a use keeping an index, re-declaring, 40 idle days).
  test('the tuning harness agrees with the model after every step, and replays identically', async () => {
    // The model counts the same retirement window the harness tunes with.
    expect(TUNING_CONFIG.deprecationWindowDays).toBe(RETIREMENT_WINDOW_DAYS);
    await assertProperty(
      'index tuning = model',
      fc.asyncProperty(
        fc.array(arbCommand, { minLength: 10, maxLength: 40, size: 'max' }),
        async (commands) => {
          const first = await runCommands(commands, 'index-tuning');
          const again = await runCommands(commands, 'index-tuning');
          expect(again).toEqual(first);
        }
      ),
      { numRuns: 128 }
    );
  }, 60_000);
});
