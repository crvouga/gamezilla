import { expect, test } from 'bun:test';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { actorPage } from '@libs/harness-ts/actor-page';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import {
  returnToTabs,
  signInWithGoogle,
  signOut,
} from '@libs/harness-ts/auth-actions';
import { openAccount } from '@libs/harness-ts/shell-actions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openConformanceHarness } from './conformance-world';

const enterTwice = scenarioAction({
  name: 'reopenConnectFourMatchmaking',
  act: async (world) => {
    const ui = await actorUi(world, 'alice');
    await ui.get(Handles.gameMenu('connect-four')).tap();
    const page = await actorPage(world, 'alice');
    const refusals: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.textContent?.includes('Not available'))
            refusals.push('Not available');
        }
      }
    });
    observer.observe(page, { childList: true, subtree: true });
    try {
      for (let entry = 0; entry < 2; entry++) {
        await ui.get(Handles.gameChoice('multiplayer')).tap();
        await ui.get('multiplayer-find').expect.visible();
        await ui.get(Handles.navBack).tap();
        await ui.get(Handles.gameChoice('multiplayer')).expect.visible();
      }
      expect(refusals).toEqual([]);
    } finally {
      observer.disconnect();
    }
  },
});

// regression: connect-four-matchmaking-entry-denial
test('a signed-in host opens Connect Four matchmaking twice without a “Not available” denial', async () => {
  await using s = await openConformanceHarness();
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(givenGameSpace, 'alice');
  await s.apply(enterTwice);
}, 60_000);

const requireAccountToView = scenarioAction({
  name: 'requireAccountToViewMatchmaking',
  act: async (world) => {
    const policy = {
      ...DEFAULT_PERMISSION_POLICY,
      restrictions: {
        ...DEFAULT_PERMISSION_POLICY.restrictions,
        matchmaking: {
          when: { auth: 'anonymous' },
          deny: [PERMISSION.matchmakingView],
          reason: 'not_granted',
        },
      },
    };
    const at = new Date(world.harness.clock.now()).toISOString();
    await world.harness.serverSql.sqlClient.run(
      sql`INSERT INTO client_config (id, value, created_at, updated_at)
        VALUES ('permission_policy', ${JSON.stringify(policy)}, ${at}, ${at})
        ON CONFLICT (id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
  },
});

test('after sign out the new guest host sees the configured matchmaking denial', async () => {
  await using s = await openConformanceHarness();
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(requireAccountToView);
  await s.apply(givenGameSpace, 'alice');
  await s.apply(enterTwice);
  await s.apply(openAccount, 'alice');
  await s.apply(signOut, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(givenGameSpace, 'alice');
  await s.apply(openFindingAnOpponent, 'alice', 'connect-four');
  await s.read(async (world) => {
    const ui = await actorUi(world, 'alice');
    await ui.get('multiplayer-access-denial').expect.visible();
    expect(await ui.get('multiplayer-access-denial').text()).toContain(
      'Not available'
    );
    expect(await ui.get('multiplayer-find').isVisible()).toBe(false);
  });
}, 60_000);
