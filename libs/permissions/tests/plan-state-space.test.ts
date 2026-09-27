/**
 * The whole membership state space, enumerated: every sign-in state × every
 * synced row status (ours, plus blank / null / vendor strings) × every period
 * end that matters around the grace boundary × every encoding of the cancel
 * flag × a zero and the shipped grace window.
 *
 * The expectations come from tables written here, not from re-running the
 * implementation's logic: a status either always grants, never grants, or
 * grants through `period end + grace`; a period end is either inside that
 * window or not.
 */
import { describe, expect, test } from 'bun:test';
import {
  ROLE,
  readSubscriptionSnapshot,
  resolveAccessFacts,
  resolvePlanRole,
  type SubscriptionRow,
} from '@libs/permissions/root/access-model';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');
const DAY = 86_400_000;
const GRACES = [0, 7 * DAY] as const;

/** How a stored status grants access. */
type Grant = 'none' | 'never' | 'always' | 'through_grace';

const STATUSES: ReadonlyArray<readonly [string | null, Grant]> = [
  ['incomplete', 'never'],
  ['trialing', 'always'],
  ['active', 'always'],
  ['delinquent', 'through_grace'],
  ['ended', 'through_grace'],
  // Anything outside our vocabulary is "no membership".
  [null, 'none'],
  ['', 'none'],
  ['past_due', 'none'],
  ['ACTIVE', 'none'],
];

type PeriodEnd = {
  readonly name: string;
  readonly raw: (grace: number) => string | null;
  /** The parsed epoch ms, or null when the row has none / an unreadable one. */
  readonly ms: (grace: number) => number | null;
  /** Is `now` within `end + grace`? */
  readonly insideGrace: boolean;
};

const iso = (ms: number): string => new Date(ms).toISOString();

function at(
  name: string,
  offset: (grace: number) => number,
  insideGrace: boolean
): PeriodEnd {
  return {
    name,
    raw: (grace) => iso(NOW + offset(grace)),
    ms: (grace) => NOW + offset(grace),
    insideGrace,
  };
}

const PERIOD_ENDS: readonly PeriodEnd[] = [
  { name: 'null', raw: () => null, ms: () => null, insideGrace: false },
  {
    name: 'unparsable',
    raw: () => 'not-a-date',
    ms: () => null,
    insideGrace: false,
  },
  at('far past', () => -365 * DAY, false),
  at('1ms past end+grace', (grace) => -grace - 1, false),
  at('exactly end+grace', (grace) => -grace, true),
  at('1ms inside end+grace', (grace) => -grace + 1, true),
  at('future', () => 30 * DAY, true),
];

const CANCEL_FLAGS: ReadonlyArray<
  readonly [SubscriptionRow['cancel_at_period_end'], boolean]
> = [
  [true, true],
  [1, true],
  [false, false],
  [0, false],
  [null, false],
];

type Case = {
  readonly signedIn: boolean;
  readonly status: readonly [string | null, Grant];
  readonly end: PeriodEnd;
  readonly flag: readonly [SubscriptionRow['cancel_at_period_end'], boolean];
  readonly grace: number;
};

function* cases(): Generator<Case> {
  for (const signedIn of [false, true]) {
    for (const status of STATUSES) {
      for (const end of PERIOD_ENDS) {
        for (const flag of CANCEL_FLAGS) {
          for (const grace of GRACES) {
            yield { signedIn, status, end, flag, grace };
          }
        }
      }
    }
  }
}

function expectedLive(grant: Grant, end: PeriodEnd): boolean {
  if (grant === 'always') return true;
  if (grant === 'through_grace') return end.insideGrace;
  return false;
}

function expectedRole(c: Case): string {
  if (!c.signedIn) return ROLE.planGuest;
  return expectedLive(c.status[1], c.end) ? ROLE.planPaid : ROLE.planFree;
}

function label(c: Case): string {
  return [
    c.signedIn ? 'signed-in' : 'signed-out',
    `status=${String(c.status[0])}`,
    `end=${c.end.name}`,
    `cancel=${String(c.flag[0])}`,
    `grace=${String(c.grace)}`,
  ].join(' ');
}

describe('membership state space', () => {
  const all = [...cases()];

  test('covers the full cartesian product', () => {
    expect(all).toHaveLength(
      2 *
        STATUSES.length *
        PERIOD_ENDS.length *
        CANCEL_FLAGS.length *
        GRACES.length
    );
  });

  test('readSubscriptionSnapshot decodes every row', () => {
    for (const c of all) {
      const snapshot = readSubscriptionSnapshot({
        status: c.status[0],
        current_period_end: c.end.raw(c.grace),
        cancel_at_period_end: c.flag[0],
      });
      const expected =
        c.status[1] === 'none'
          ? null
          : {
              status: c.status[0],
              currentPeriodEndMs: c.end.ms(c.grace),
              cancelAtPeriodEnd: c.flag[1],
            };
      expect<unknown>({ case: label(c), snapshot }).toEqual({
        case: label(c),
        snapshot: expected,
      });
    }
  });

  test('resolveAccessFacts and resolvePlanRole agree with the tables', () => {
    for (const c of all) {
      const planFacts = {
        signedIn: c.signedIn,
        subscription: readSubscriptionSnapshot({
          status: c.status[0],
          current_period_end: c.end.raw(c.grace),
          cancel_at_period_end: c.flag[0],
        }),
        nowMs: NOW,
        graceMs: c.grace,
        confirmedAtMs: NOW,
        billingEnabled: true,
      };
      const role = expectedRole(c);
      expect<unknown>({
        case: label(c),
        facts: resolveAccessFacts(planFacts),
        role: resolvePlanRole(planFacts),
      }).toEqual({
        case: label(c),
        facts: {
          auth: c.signedIn ? 'verified' : 'anonymous',
          membership: role === ROLE.planPaid ? 'active' : 'none',
          billing: 'on',
        },
        role,
      });
    }
  });
});
