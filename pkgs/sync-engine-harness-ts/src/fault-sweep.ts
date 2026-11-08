/**
 * Run any scripted scenario under a named fault profile: the wire hazards
 * come from the profile's runtime, the scenario body calls `chaos()` between
 * its own steps to let the seeded adversary strike, and once the body ends
 * the network heals and the standing offline-first invariants are checked
 * on the app's own recovery (nothing is nudged).
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { faultProfileRuntime, exampleSystem } from './example-app-system';
import type { FaultAdversary, FaultMove } from './fault-adversary';
import { createFaultAdversary } from './fault-adversary';
import type { FaultProfile } from './fault-profiles';
import type { SyncArgs } from './args';
import type { SyncHarness } from './scenario-system';
import { inSync } from './sync-observations';
import type { LedgerWrite } from './write-ledger';
import { ledgerViolations, statusViolations } from './write-ledger';

/** Virtual time the app gets to recover on its own once the network heals. */
export const HEAL_BUDGET_MS = 10 * 60_000;
const HEAL_STEP_MS = 1_000;

export type FaultScenario = {
  readonly s: Run<SyncHarness>;
  readonly adversary: FaultAdversary;
  /** One adversary turn: lift ended gaps, maybe strike again. */
  readonly chaos: () => Promise<readonly FaultMove[]>;
  /** Writes the person was told were saved, for the no-loss check. */
  readonly ledger: LedgerWrite[];
  /** Status violations seen at any `chaos()` turn. */
  readonly statusSeen: string[];
};

export type FaultSweepOutcome = {
  readonly profile: string;
  readonly seed: number;
  readonly moves: readonly FaultMove[];
  readonly writes: number;
  /** Empty when every offline-first invariant held. */
  readonly violations: readonly string[];
  /** Virtual ms from heal until the devices agreed (null: never). */
  readonly convergedAfterMs: number | null;
};

async function settledViolations(
  scenario: FaultScenario
): Promise<{ violations: string[]; after: number | null }> {
  const { s } = scenario;
  let waited = 0;
  for (;;) {
    const agreed = await s.read(inSync);
    const ledger = await ledgerViolations(s, scenario.ledger);
    if (agreed && ledger.length === 0) return { violations: [], after: waited };
    if (waited >= HEAL_BUDGET_MS) {
      return {
        violations: [
          ...(agreed ? [] : ['devices never agreed after the network healed']),
          ...ledger,
        ],
        after: null,
      };
    }
    await s.advanceTime(HEAL_STEP_MS);
    waited += HEAL_STEP_MS;
  }
}

/**
 * Open the example system under `profile`, run `body`, heal, and report
 * every invariant the run broke. Same profile + seed + body ⇒ same run.
 */
export async function runUnderFaultProfile(args: {
  readonly profile: FaultProfile;
  readonly seed: number;
  readonly args?: Partial<SyncArgs>;
  readonly body: (scenario: FaultScenario) => Promise<void>;
}): Promise<FaultSweepOutcome> {
  await using s = await exampleSystem.run({
    seed: args.seed,
    runtime: faultProfileRuntime(args.profile.name),
    args: { clientCount: 0, ...args.args },
  });
  const adversary = createFaultAdversary(args.profile, args.seed);
  const statusSeen: string[] = [];
  const scenario: FaultScenario = {
    s,
    adversary,
    ledger: [],
    statusSeen,
    chaos: async () => {
      statusSeen.push(...(await statusViolations(s)));
      return adversary.turn(s);
    },
  };
  await args.body(scenario);
  await adversary.heal(s);
  const settled = await settledViolations(scenario);
  return {
    profile: args.profile.name,
    seed: args.seed,
    moves: adversary.applied(),
    writes: scenario.ledger.length,
    violations: [
      ...new Set([...statusSeen, ...(await statusViolations(s))]),
      ...settled.violations,
    ],
    convergedAfterMs: settled.after,
  };
}
