/**
 * Every environment reads the account-wide secrets through its import of the
 * shared environment; a copy held by the environment itself would shadow the
 * import (and a rotation in the shared environment would never reach it).
 * This plans the convergence, per shared secret name:
 *
 *   - the shared environment has no value, and every environment holding a
 *     copy agrees on one → promote that value to the shared environment;
 *   - a copy equal to the shared value → delete it (the import supplies it);
 *   - copies that disagree (with the shared value or each other) → conflict:
 *     nothing is changed for that name, and a person decides.
 *
 * Values never leave this module in the plan's messages.
 */

export type SharedReconcilePlan = {
  readonly promote: readonly {
    readonly name: string;
    readonly value: string;
  }[];
  readonly remove: readonly { readonly env: string; readonly name: string }[];
  readonly conflicts: readonly string[];
};

type Copy = { readonly env: string; readonly value: string };

function copiesOf(
  name: string,
  envs: ReadonlyMap<string, ReadonlyMap<string, string>>
): Copy[] {
  const copies: Copy[] = [];
  for (const [env, own] of envs) {
    const value = own.get(name);
    if (value !== undefined && value.trim().length > 0) {
      copies.push({ env, value });
    }
  }
  return copies;
}

export function planSharedReconcile(args: {
  readonly names: readonly string[];
  readonly shared: ReadonlyMap<string, string>;
  /** Each environment's own secrets (imports excluded). */
  readonly envs: ReadonlyMap<string, ReadonlyMap<string, string>>;
}): SharedReconcilePlan {
  const promote: { name: string; value: string }[] = [];
  const remove: { env: string; name: string }[] = [];
  const conflicts: string[] = [];
  for (const name of args.names) {
    const copies = copiesOf(name, args.envs);
    if (copies.length === 0) continue;
    const stored = args.shared.get(name);
    const canonical =
      stored !== undefined && stored.trim().length > 0
        ? stored
        : copies[0]?.value;
    const disagreeing = copies.filter((c) => c.value !== canonical);
    if (disagreeing.length > 0) {
      conflicts.push(
        `${name}: ${disagreeing.map((c) => c.env).join(', ')} hold a different value than ${stored === undefined ? copies[0]?.env : 'the shared environment'}`
      );
      continue;
    }
    if (canonical !== stored && canonical !== undefined) {
      promote.push({ name, value: canonical });
    }
    for (const copy of copies) remove.push({ env: copy.env, name });
  }
  return { promote, remove, conflicts };
}
