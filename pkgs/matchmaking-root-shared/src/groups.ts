/** Complete mutually accepting groups, considered in the caller's accepted order. */
import { assert } from '@pkgs/assert-root-shared/singleton';
import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MIN_GROUP_SIZE,
} from './payload-limits';

type Candidate = { readonly id: string };
export type GroupPlan<T extends Candidate> = {
  readonly candidates: readonly T[];
  readonly groupSize: number;
  readonly maxGroups: number;
  /** Includes both people's acceptance and any current pair restriction. */
  readonly acceptsPair: (a: T, b: T) => boolean;
};

type GroupSearch<T extends Candidate> = Pick<
  GroupPlan<T>,
  'groupSize' | 'acceptsPair'
>;

function completeGroup<T extends Candidate>(
  group: readonly T[],
  remaining: readonly T[],
  search: GroupSearch<T>
): readonly T[] | null {
  if (group.length === search.groupSize) return group;
  const needed = search.groupSize - group.length;
  for (let i = 0; i <= remaining.length - needed; i += 1) {
    const next = remaining[i];
    if (next === undefined) continue;
    const after = remaining
      .slice(i + 1)
      .filter((candidate) => search.acceptsPair(next, candidate));
    if (after.length < needed - 1) continue;
    const found = completeGroup([...group, next], after, search);
    if (found !== null) return found;
  }
  return null;
}

/** Earlier compatible opportunities win; an incomplete choice never blocks a complete group. */
export function planGroups<T extends Candidate>(
  args: GroupPlan<T>
): readonly (readonly T[])[] {
  assert.ok(
    Number.isInteger(args.groupSize) &&
      args.groupSize >= MATCHMAKING_MIN_GROUP_SIZE &&
      args.groupSize <= MATCHMAKING_MAX_GROUP_SIZE,
    'matchmaking: invalid group size'
  );
  assert.ok(
    Number.isInteger(args.maxGroups) && args.maxGroups >= 0,
    'matchmaking: invalid group limit'
  );
  const groups: (readonly T[])[] = [];
  const taken = new Set<string>();
  for (let i = 0; i <= args.candidates.length - args.groupSize; i += 1) {
    if (groups.length >= args.maxGroups) break;
    const first = args.candidates[i];
    if (first === undefined || taken.has(first.id)) continue;
    const remaining = args.candidates
      .slice(i + 1)
      .filter(
        (candidate) =>
          !taken.has(candidate.id) && args.acceptsPair(first, candidate)
      );
    const group = completeGroup([first], remaining, args);
    if (group === null) continue;
    for (const member of group) taken.add(member.id);
    groups.push(group);
  }
  return groups;
}
