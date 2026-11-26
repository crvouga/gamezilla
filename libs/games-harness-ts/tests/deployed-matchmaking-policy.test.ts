import { expect, test } from 'bun:test';
import { pairGameOpponents } from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { requestGameOpponent } from '@libs/game-matchmaking-harness-ts/multiplayer-search-ui';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { publishDeploymentPolicy } from '@libs/permissions-server-ts/publish-deployment-policy';
import { decideMatchedGameAllowance } from '@libs/permissions-shared-ts/matched-game-allowance';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { readPermissionPolicy } from '@libs/permissions-shared-ts/read-access';
import { decide } from '@pkgs/permissions-shared-ts/decision';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openConformanceHarness } from './conformance-world';

// The relevant signed-in role from the persisted policy in Release 45839922005.
const prior = {
  version: '2026-10-23.1',
  roles: {
    'plan:free': {
      when: { auth: 'verified', membership: 'none' },
      permissions: ['matchmaking:use'],
      quotas: { 'puzzle.rated.solve': { limit: null, window: 'day' } },
    },
  },
};
const facts = { auth: 'verified', membership: 'none' } as const;
const upgrade = scenarioAction({
  name: 'deployWithPriorMatchmakingPolicy',
  act: async ({ harness }) => {
    const db = harness.serverSql.sqlClient;
    const at = new Date(harness.clock.now()).toISOString();
    await db.run(sql`INSERT INTO client_config (id, value, created_at, updated_at)
      VALUES ('permission_policy', ${JSON.stringify(prior)}, ${at}, ${at})
      ON CONFLICT (id) DO UPDATE SET value = excluded.value`);
    const old = await readPermissionPolicy(db);
    const subject = resolveSubject(old, facts);
    expect(decide(old, subject, PERMISSION.matchmakingUse).allowed).toBe(true);
    expect(
      decideMatchedGameAllowance(old, subject, {
        nowMs: harness.clock.now(),
        startedAt: [],
      })
    ).toMatchObject({
      allowed: false,
      reason: 'not_granted',
      policyVersion: prior.version,
    });
    await publishDeploymentPolicy(db, harness.clock, harness.server.events!, [
      'staff',
    ]);
    const current = await readPermissionPolicy(db);
    for (const accountId of ['player', 'staff']) {
      const account = resolveSubject(current, { ...facts, accountId });
      expect(decide(current, account, PERMISSION.adminAccess).allowed).toBe(
        accountId === 'staff'
      );
    }
  },
});

// regression: deployed-matchmaking-policy-stale
test.each(['battleship', 'connect-four', 'quoridor'])(
  'two signed-in people reach the same %s board after upgrading the deployment policy',
  async (game) => {
    await using s = await openConformanceHarness();
    for (const person of ['alice', 'bob']) {
      await s.apply(signInWithGoogle, person);
      await s.apply(givenGameSpace, person);
      await s.apply(openFindingAnOpponent, person, game);
    }
    await s.apply(upgrade);
    for (const person of ['alice', 'bob']) {
      await s.apply(requestGameOpponent, person, '5+0');
      await s.advanceTime(1);
    }
    await s.apply(pairGameOpponents);
    const ids = [];
    for (const person of ['alice', 'bob']) {
      const id = await s.until(
        async (world) => {
          const board = (await actorUi(world, person)).get('multiplayer-game');
          return (await board.isVisible())
            ? board.attribute('data-game-id')
            : null;
        },
        { pred: (value) => Boolean(value) }
      );
      ids.push(id);
    }
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
  },
  60_000
);
