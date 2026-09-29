/**
 * The decision tables' words for people and places, turned into what the
 * permission system reads: raw access inputs (resolved to facts by the
 * product's own `resolveAccessFacts`), the session identity a server sees,
 * the synced membership rows behind a Plus member, and a presence role in a
 * space. Nothing here decides anything; it only says who the case is about.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import { DEFAULT_BILLING_GRACE_PERIOD_MS } from '@libs/client-config/public/client-config-defaults';
import type { Facts } from '@pkgs/permissions';

import {
  type AccessInputs,
  governingSubscription,
  resolveAccessFacts,
  type SubscriptionRow,
} from '../../shared/access-facts';
import type { SpacePresenceRole } from '../../shared/permission-catalog';
import type { AccessIdentity } from '../../shared/read-access';

/** The input names the decision tables use (their FEEL names). */
export const DMN_INPUT = {
  who: 'who is asking',
  capability: 'what they want to do',
  payments: 'payments are offered',
  place: 'their place in the space',
  open: 'open spaces they host',
  today: 'rated puzzles solved today',
  earlier: 'rated puzzles solved before today',
} as const;

/** A decision case's inputs, keyed by those names. */
export type CaseInput = Readonly<Record<string, unknown>>;

export type Person = 'guest' | 'free account' | 'Plus member';

/**
 * The instant every case is judged at: midday UTC, so "today" and "before
 * today" are both a whole UTC day wide around it.
 */
export const CASE_NOW_MS = Date.parse('2026-09-19T12:00:00.000Z');

const DAY_MS = 86_400_000;

/** The one account every signed-in case is about (ids are UUIDs, as stored). */
const ACCOUNT_ID = '00000000-0000-4000-8000-00000000acc0';

/** The guest's own user id (a guest is their install's anonymous user). */
const GUEST_ACTOR_ID = '00000000-0000-4000-8000-000000000e57';

/** The device every case runs on. */
export const DEVICE_ID = '00000000-0000-4000-8000-0000000de71c';

function stringInput(input: CaseInput, name: string): string {
  const value = input[name];
  if (typeof value !== 'string') {
    throw new Error(`conformance: case has no "${name}"`);
  }
  return value;
}

/** A number input of the case (a count). */
export function countInput(input: CaseInput, name: string): number {
  const value = input[name];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`conformance: case has no count "${name}"`);
  }
  return value;
}

/** Who the case is about. */
export function personOf(input: CaseInput): Person {
  const who = stringInput(input, DMN_INPUT.who);
  if (who === 'guest' || who === 'free account' || who === 'Plus member') {
    return who;
  }
  throw new Error(`conformance: unknown person "${who}"`);
}

/** The capability the case asks about (a manifest id). */
export function capabilityOf(input: CaseInput): string {
  return stringInput(input, DMN_INPUT.capability);
}

/**
 * Whether payments are offered: the table's answer when it has the input,
 * otherwise yes (a deployment with a membership provider — the only one a
 * Plus member can exist in).
 */
export function paymentsOfferedOf(input: CaseInput): boolean {
  if (!Object.hasOwn(input, DMN_INPUT.payments)) return true;
  const payments = stringInput(input, DMN_INPUT.payments);
  if (payments === 'yes') return true;
  if (payments === 'no') return false;
  throw new Error(`conformance: unknown payments answer "${payments}"`);
}

/**
 * Their presence in the space: the host holds the host role, someone who
 * joined holds the member role (`guest` presence), someone not in it holds
 * none.
 */
export function spacePresenceOf(input: CaseInput): SpacePresenceRole | null {
  const place = stringInput(input, DMN_INPUT.place);
  if (place === 'host') return 'host';
  if (place === 'joined') return 'guest';
  if (place === 'not in it') return null;
  throw new Error(`conformance: unknown place "${place}"`);
}

/** A Plus member's membership: live, renewing, well inside its period. */
export function membershipRowsFor(
  person: Person,
  nowMs: number
): readonly SubscriptionRow[] {
  if (person !== 'Plus member') return [];
  return [
    {
      status: 'active',
      current_period_end: new Date(nowMs + 30 * DAY_MS).toISOString(),
      cancel_at_period_end: 0,
    },
  ];
}

/** The session identity a server resolves for the person. */
export function identityFor(person: Person): AccessIdentity {
  return person === 'guest'
    ? { actorId: GUEST_ACTOR_ID, accountId: null, isAnon: true }
    : { actorId: ACCOUNT_ID, accountId: ACCOUNT_ID, isAnon: false };
}

/**
 * Raw access inputs for the person, as the server judges them: the synced
 * membership rows read the way the server reads them, confirmed now, the
 * shipped grace period.
 */
export function accessInputsFor(
  person: Person,
  at: { readonly nowMs: number; readonly paymentsOffered: boolean }
): AccessInputs {
  return {
    signedIn: person !== 'guest',
    subscription: governingSubscription(membershipRowsFor(person, at.nowMs)),
    nowMs: at.nowMs,
    graceMs: DEFAULT_BILLING_GRACE_PERIOD_MS,
    confirmedAtMs: at.nowMs,
    billingEnabled: at.paymentsOffered,
  };
}

/** The facts the product resolves for the case's person and deployment. */
export function factsOf(input: CaseInput, nowMs: number): Facts {
  return resolveAccessFacts(
    accessInputsFor(personOf(input), {
      nowMs,
      paymentsOffered: paymentsOfferedOf(input),
    })
  );
}
