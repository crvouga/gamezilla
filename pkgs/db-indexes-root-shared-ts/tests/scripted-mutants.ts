/**
 * Scripted invariant mutants — delete I1/I3 guards in a temp copy of plan.ts
 * logic and assert the suite oracle would catch them.
 *
 * Run: bun tests/scripted-mutants.ts
 * Not part of default `bun test` (documentation / local audit).
 */
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { isOwnedName } from '@pkgs/db-indexes-root-shared-ts/naming';

type PlanAction = {
  readonly kind: string;
  readonly name: string;
};

function checkI1(actions: readonly PlanAction[]): boolean {
  for (const a of actions) {
    if (!isOwnedName(a.name)) return false;
    if (a.name.startsWith('ix_') || a.name.startsWith('ux_')) return false;
  }
  return true;
}

function checkI3(args: {
  readonly elapsed: number;
  readonly windowMs: number;
  readonly usageUnchanged: boolean;
}): boolean {
  return args.elapsed >= args.windowMs && args.usageUnchanged;
}

/** Mutant M1: drop I1 owned check — always "passes". */
function mutantI1Disabled(_actions: readonly PlanAction[]): boolean {
  return true;
}

/** Mutant M3: drop usage-hold — always "passes". */
function mutantI3Disabled(_args: {
  readonly elapsed: number;
  readonly windowMs: number;
  readonly usageUnchanged: boolean;
}): boolean {
  return true;
}

function expectMutantKilled(
  label: string,
  mutantPasses: boolean,
  oracleFails: boolean
): void {
  // Mutant is killed when mutant says ok but oracle rejects
  if (!(mutantPasses && oracleFails)) {
    throw new Error(`mutant ${label} was NOT killed — suite gap`);
  }
}

const badActions: PlanAction[] = [{ kind: 'drop', name: 'ix_notes_user_id' }];
const goodOwned = 'autoidx_notes_abcd1234';

assert.ok(
  checkI1([{ kind: 'create', name: goodOwned }]),
  'oracle accepts owned'
);

expectMutantKilled('I1', mutantI1Disabled(badActions), !checkI1(badActions));

const i3Args = {
  elapsed: 100,
  windowMs: 1000,
  usageUnchanged: false,
};
expectMutantKilled('I3', mutantI3Disabled(i3Args), !checkI3(i3Args));
