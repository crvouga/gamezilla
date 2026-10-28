/**
 * Split a long path list across several runs of one command. Windows caps a
 * whole command line at 32,767 characters (`CreateProcess`) and every
 * `bunx <tool>` hop re-spends it, so a run over every root file failed there
 * with `ENAMETOOLONG` while macOS and Linux took it whole. Each batch stays
 * well under the cap on every OS; per-file tools report exactly what one run
 * would.
 */

/** Characters of arguments one batch may carry, leaving room for the rest. */
export const ARGUMENT_BUDGET = 16_000;

/** Each argument costs its text, a separating space and possible quotes. */
function cost(arg: string): number {
  return arg.length + 3;
}

/**
 * `args` in order, grouped so each group's cost fits `budget`. An argument
 * too long for any budget gets a group of its own; no args, no groups.
 */
export function argumentBatches(
  args: readonly string[],
  budget: number = ARGUMENT_BUDGET
): readonly (readonly string[])[] {
  const batches: string[][] = [];
  let current: string[] = [];
  let used = 0;
  for (const arg of args) {
    if (current.length > 0 && used + cost(arg) > budget) {
      batches.push(current);
      current = [];
      used = 0;
    }
    current.push(arg);
    used += cost(arg);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
