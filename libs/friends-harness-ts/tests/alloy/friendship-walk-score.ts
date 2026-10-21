/**
 * Which friendship trace stresses `specs/friends/friendships.als` most: one
 * that passes through friends (`FriendsBothWays`,
 * `NoFriendRequestBetweenFriends`), a waiting request
 * (`OneFriendRequestBetweenTwo`), a block landing on a waiting request and
 * one landing on a friendship (`BlockEndsFriendshipAndRequests`,
 * `BlocksGoOneWay`); then the one taking the most actions.
 */

import { distinctActions } from '@libs/harness-ts/quint-walk';
import type { ItfState, ItfTrace, QuintValue } from '@pkgs/quint-shared-ts/itf';

type Status = 'Friend' | 'RequestSent' | 'RequestReceived' | string;

function statusOf(state: ItfState, person: QuintValue, other: QuintValue) {
  const all = state.vars['friendshipStatus'];
  const mine = all instanceof Map ? all.get(person) : undefined;
  const status = mine instanceof Map ? mine.get(other) : undefined;
  const tag =
    typeof status === 'object' && status !== null && 'tag' in status
      ? status.tag
      : undefined;
  return typeof tag === 'string' ? (tag as Status) : null;
}

function anyStatus(state: ItfState, wanted: Status): boolean {
  const all = state.vars['friendshipStatus'];
  if (!(all instanceof Map)) return false;
  return [...all.values()].some(
    (row) =>
      row instanceof Map &&
      [...row.values()].some(
        (s) =>
          typeof s === 'object' && s !== null && 'tag' in s && s.tag === wanted
      )
  );
}

/** The situations the trace passes through, of the four the structure needs. */
function situations(trace: ItfTrace): number {
  const seen = new Set<string>();
  for (const [i, state] of trace.states.entries()) {
    if (anyStatus(state, 'Friend')) seen.add('friends');
    if (anyStatus(state, 'RequestSent')) seen.add('request');
    const before = trace.states[i - 1];
    if (state.action !== 'block' || before === undefined) continue;
    const was = statusOf(
      before,
      state.picks['person'] ?? '',
      state.picks['other'] ?? ''
    );
    if (was === 'Friend') seen.add('block on friends');
    if (was === 'RequestSent' || was === 'RequestReceived') {
      seen.add('block on a request');
    }
  }
  return seen.size;
}

export function friendshipWalkScore(trace: ItfTrace): number {
  return situations(trace) * 100 + distinctActions(trace);
}
