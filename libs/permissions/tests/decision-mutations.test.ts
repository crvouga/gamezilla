/**
 * The decision tables catch realistic violations (strategy § 21). Each test
 * seeds one fault into a disposable copy — an inverted permission, a moved
 * limit, a server that authorizes everything, a client gate that always
 * shows — and requires the spec comparison to report mismatches; the
 * shipped system, compared the same way, reports none.
 */
import { describe, expect, test } from 'bun:test';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import {
  DEFAULT_PERMISSION_POLICY,
  ROLE,
} from '@libs/permissions/root/access-model';
import {
  accessApplicationLayer,
  dailyPuzzleLimitApplicationLayer,
  hostingLimitApplicationLayer,
  spaceRolesApplicationLayer,
} from '@libs/permissions/root/conformance/application';
import { clientGatingLayer } from '@libs/permissions/root/conformance/client';
import {
  accessClientLayer,
  dailyPuzzleLimitClientLayer,
} from '@libs/permissions/root/conformance/client-layers';
import {
  queryGuardOperation,
  routeGuardOperation,
} from '@libs/permissions/root/conformance/server';
import {
  accessServerLayer,
  dailyPuzzleLimitServerLayer,
} from '@libs/permissions/root/conformance/server-layers';
import type { AppPolicy } from '@libs/permissions/root/conformance/world';
import { authorizeAppMutation } from '@libs/permissions/root/server/authorize-app-mutation';
import { generateCases } from '@pkgs/dmn/cases';
import { compareLayer } from '@pkgs/dmn/compare';
import type { DmnDecision } from '@pkgs/dmn/model';
import type { DecisionLayer } from '@pkgs/dmn/registry';
import type { RoleSpec } from '@pkgs/permissions';
import { sql } from '@pkgs/sql';

import { billingSubscriptionsFixture } from './support/billing-fixture';
import { decisionAt } from './support/specs';

const TABLES = [billingSubscriptionsFixture];
const ACCESS = ['billing/access.dmn', 'access'] as const;
const SPACE_ROLES = ['spaces/space-roles.dmn', 'space-roles'] as const;
const HOSTING = ['spaces/hosting-limit.dmn', 'hosting-limit'] as const;
const DAILY = ['chess/daily-puzzle-limit.dmn', 'daily-puzzle-limit'] as const;

type Table = readonly [string, string];

async function mismatches(
  table: Table,
  layer: DecisionLayer
): Promise<{
  readonly checked: number;
  readonly mismatched: number;
  readonly reasons: readonly string[];
}> {
  const decision: DmnDecision = await decisionAt(...table);
  const result = await compareLayer({
    decision,
    cases: generateCases(decision),
    layer,
  });
  return {
    checked: result.checked,
    mismatched: result.mismatches.length,
    reasons: result.mismatches.map((m) => m.reason),
  };
}

type Spec = RoleSpec<string, string>;

function changeRole(role: string, change: (spec: Spec) => Spec): AppPolicy {
  const spec = DEFAULT_PERMISSION_POLICY.roles[role];
  if (spec === undefined) throw new Error(`no role ${role}`);
  return {
    ...DEFAULT_PERMISSION_POLICY,
    version: 'mutated',
    roles: { ...DEFAULT_PERMISSION_POLICY.roles, [role]: change(spec) },
  } as AppPolicy;
}

/** Billing's own routes: the billing binding runs them, not this package. */
const UNGOVERNED = {
  subscribe: 'the checkout route lives in billing',
  'use the billing portal': 'the portal route lives in billing',
  'see the billing plans': 'no server boundary: the plans are app data',
};

/** The routes whose request guard this package owns the decision for. */
const ROUTES = {
  'get notifications': routeGuardOperation(PERMISSION.notificationsReceive),
  'wait for a match': routeGuardOperation(PERMISSION.matchmakingUse),
  'use people search': queryGuardOperation(PERMISSION.peopleSearch),
};

describe('the shipped permission system agrees with every table', () => {
  test('application decisions', async () => {
    for (const [table, layer] of [
      [ACCESS, accessApplicationLayer()],
      [SPACE_ROLES, spaceRolesApplicationLayer()],
      [HOSTING, hostingLimitApplicationLayer()],
      [DAILY, dailyPuzzleLimitApplicationLayer()],
    ] as const) {
      const result = await mismatches(table, layer);
      expect({ table: table[1], ...result }).toMatchObject({
        table: table[1],
        mismatched: 0,
      });
      expect(result.checked).toBeGreaterThan(0);
    }
  });

  test('server enforcement', async () => {
    const access = await mismatches(
      ACCESS,
      accessServerLayer({
        tables: TABLES,
        routes: ROUTES,
        ungoverned: UNGOVERNED,
      })
    );
    const daily = await mismatches(
      DAILY,
      dailyPuzzleLimitServerLayer({ tables: TABLES })
    );
    expect([access.mismatched, daily.mismatched]).toEqual([0, 0]);
    expect(access.checked).toBeGreaterThan(0);
    expect(daily.checked).toBeGreaterThan(0);
  });

  test('client gating', async () => {
    const access = await mismatches(
      ACCESS,
      accessClientLayer({ tables: TABLES })
    );
    const daily = await mismatches(
      DAILY,
      dailyPuzzleLimitClientLayer({ tables: TABLES })
    );
    expect([access.mismatched, daily.mismatched]).toEqual([0, 0]);
    expect([access.checked, daily.checked]).toEqual([66, 54]);
  });
});

describe('seeded faults are caught', () => {
  test('an inverted permission: guests may no longer join a space', async () => {
    const policy = changeRole(ROLE.planGuest, (spec) => ({
      ...spec,
      permissions: (spec.permissions ?? []).filter(
        (key) => key !== PERMISSION.spacesJoin
      ),
    }));
    const application = await mismatches(
      ACCESS,
      accessApplicationLayer(policy)
    );
    const server = await mismatches(
      ACCESS,
      accessServerLayer({
        tables: TABLES,
        routes: ROUTES,
        ungoverned: UNGOVERNED,
        policy,
      })
    );
    const client = await mismatches(
      ACCESS,
      accessClientLayer({ tables: TABLES, policy })
    );
    expect(application.mismatched).toBeGreaterThan(0);
    expect(server.mismatched).toBeGreaterThan(0);
    expect(client.mismatched).toBeGreaterThan(0);
  });

  test("a moved limit: a guest's daily puzzle limit is 21, not 20", async () => {
    const policy = changeRole(ROLE.planGuest, (spec) => ({
      ...spec,
      quotas: {
        'puzzle.rated.solve': {
          limit: 21,
          window: 'day',
          resetBoundary: 'utcMidnight',
        },
      },
    }));
    const application = await mismatches(
      DAILY,
      dailyPuzzleLimitApplicationLayer(policy)
    );
    const server = await mismatches(
      DAILY,
      dailyPuzzleLimitServerLayer({ tables: TABLES, policy })
    );
    const client = await mismatches(
      DAILY,
      dailyPuzzleLimitClientLayer({ tables: TABLES, policy })
    );
    expect(application.mismatched).toBeGreaterThan(0);
    expect(server.mismatched).toBeGreaterThan(0);
    expect(client.mismatched).toBeGreaterThan(0);
  });

  test('an off-by-one hosting limit: two open spaces, not one', async () => {
    const twoSpaces = (spec: Spec): Spec => ({
      ...spec,
      limits: { 'spaces:hosted': 2 },
    });
    const policy = changeRole(ROLE.planFree, twoSpaces);
    const result = await mismatches(
      HOSTING,
      hostingLimitApplicationLayer(policy)
    );
    expect(result.mismatched).toBeGreaterThan(0);
  });

  test('server enforcement removed: the replay authorizes everything', async () => {
    const result = await mismatches(
      ACCESS,
      accessServerLayer({
        tables: TABLES,
        routes: ROUTES,
        ungoverned: UNGOVERNED,
        guard: () => Promise.resolve(),
      })
    );
    expect(result.mismatched).toBeGreaterThan(0);
  });

  test('a refusal that leaves rows behind: the replay writes, then refuses', async () => {
    const result = await mismatches(
      ACCESS,
      accessServerLayer({
        tables: TABLES,
        routes: ROUTES,
        ungoverned: UNGOVERNED,
        guard: async ({ tx, env, ...rest }) => {
          await tx.run(sql`
            INSERT INTO permissions_quota_ledger (
              id, owner_id, quota, idempotency_key, amount, consumed_at,
              policy_version, created_at, updated_at, deleted_at
            ) VALUES (
              ${env.createId()}, ${env.actorId}, 'leftover', ${env.createId()},
              1, '2026-09-19T12:00:00.000Z', 'v', '2026-09-19T12:00:00.000Z',
              '2026-09-19T12:00:00.000Z', NULL
            )
          `);
          await authorizeAppMutation({ tx, env, ...rest });
        },
      })
    );
    // The answers are the product's; only the rows a refusal left differ.
    expect(result.mismatched).toBeGreaterThan(0);
    expect(new Set(result.reasons)).toEqual(
      new Set(['the layer threw: the refused operation changed stored rows'])
    );
  });

  test('client gating broken: the device shows every feature', async () => {
    // Mounted in the same device world as the real gate, but reading no
    // decision: the feature is always there.
    const alwaysShown = clientGatingLayer({
      tables: TABLES,
      probe: () => () => ({ answer: 'yes' }),
    });
    for (const table of [ACCESS, SPACE_ROLES, HOSTING, DAILY]) {
      const result = await mismatches(table, alwaysShown);
      expect({ table: table[1], caught: result.mismatched > 0 }).toEqual({
        table: table[1],
        caught: true,
      });
    }
  });
});
