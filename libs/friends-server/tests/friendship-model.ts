/**
 * Reference model of the friendship state machine: a few sets and a request
 * list, with each transition written as the product rule it enforces. The
 * property drives the same command against this model and the real mutations
 * and requires identical outcomes and identical live state.
 */
import type { FriendsSnapshot } from './friendship-harness';

export const RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type ModelRequest = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  status: RequestStatus;
  respondedAtMs: number | null;
};

export type FriendsModel = {
  nowMs: number;
  nextId: number;
  readonly friends: Set<string>;
  readonly blocks: Set<string>;
  readonly requests: ModelRequest[];
};

export function createModel(nowMs: number): FriendsModel {
  return {
    nowMs,
    nextId: 0,
    friends: new Set(),
    blocks: new Set(),
    requests: [],
  };
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function blockedEither(m: FriendsModel, a: string, b: string): boolean {
  return m.blocks.has(`${a}>${b}`) || m.blocks.has(`${b}>${a}`);
}

function pending(m: FriendsModel, from: string, to: string): boolean {
  return m.requests.some(
    (r) => r.from === from && r.to === to && r.status === 'pending'
  );
}

function inCooldown(m: FriendsModel, from: string, to: string): boolean {
  const declinedAt = m.requests
    .filter((r) => r.from === from && r.to === to && r.status === 'declined')
    .map((r) => r.respondedAtMs ?? Number.NEGATIVE_INFINITY);
  if (declinedAt.length === 0) return false;
  return m.nowMs - Math.max(...declinedAt) < RESEND_COOLDOWN_MS;
}

function closePendingBetween(
  m: FriendsModel,
  a: string,
  b: string,
  status: RequestStatus
): void {
  for (const r of m.requests) {
    const between =
      (r.from === a && r.to === b) || (r.from === b && r.to === a);
    if (between && r.status === 'pending') {
      r.status = status;
      r.respondedAtMs = m.nowMs;
    }
  }
}

export function modelSend(
  m: FriendsModel,
  from: string,
  to: string,
  id: string
): string {
  if (from === to) return 'FRIENDS_SELF';
  if (blockedEither(m, from, to)) return 'FRIENDS_BLOCKED';
  if (m.friends.has(pairKey(from, to))) return 'FRIENDS_ALREADY_FRIENDS';
  if (pending(m, from, to)) return 'ok';
  if (pending(m, to, from)) return 'FRIENDS_REQUEST_EXISTS';
  if (inCooldown(m, from, to)) return 'FRIENDS_COOLDOWN';
  m.requests.push({ id, from, to, status: 'pending', respondedAtMs: null });
  return 'ok';
}

export function modelAccept(
  m: FriendsModel,
  actor: string,
  request: ModelRequest | undefined
): string {
  if (request === undefined) return 'FRIENDS_NOT_FOUND';
  if (request.to !== actor) return 'FRIENDS_FORBIDDEN';
  if (request.status === 'accepted') return 'ok';
  if (request.status !== 'pending') return 'FRIENDS_FORBIDDEN';
  if (blockedEither(m, actor, request.from)) return 'FRIENDS_BLOCKED';
  closePendingBetween(m, actor, request.from, 'accepted');
  m.friends.add(pairKey(actor, request.from));
  return 'ok';
}

/** Decline (recipient) or cancel (sender): close one pending request. */
export function modelClose(
  m: FriendsModel,
  actor: string,
  request: ModelRequest | undefined,
  as: 'declined' | 'cancelled'
): string {
  if (request === undefined) return 'FRIENDS_NOT_FOUND';
  const party = as === 'declined' ? request.to : request.from;
  if (party !== actor) return 'FRIENDS_FORBIDDEN';
  if (request.status === 'pending') {
    request.status = as;
    request.respondedAtMs = m.nowMs;
  }
  return 'ok';
}

export function modelRemove(m: FriendsModel, actor: string, other: string) {
  if (actor === other) return 'FRIENDS_SELF';
  if (!m.friends.delete(pairKey(actor, other))) return 'FRIENDS_NOT_FOUND';
  return 'ok';
}

export function modelBlock(m: FriendsModel, actor: string, other: string) {
  if (actor === other) return 'FRIENDS_SELF';
  m.friends.delete(pairKey(actor, other));
  closePendingBetween(m, actor, other, 'cancelled');
  m.blocks.add(`${actor}>${other}`);
  return 'ok';
}

export function modelUnblock(m: FriendsModel, actor: string, other: string) {
  if (actor === other) return 'FRIENDS_SELF';
  m.blocks.delete(`${actor}>${other}`);
  return 'ok';
}

export function modelSnapshot(m: FriendsModel): FriendsSnapshot {
  return {
    friendships: [...m.friends].sort(),
    requests: m.requests
      .map((r) => `${r.id} ${r.from}>${r.to} ${r.status}`)
      .sort(),
    blocks: [...m.blocks].sort(),
  };
}
