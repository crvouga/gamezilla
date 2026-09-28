import { test } from 'bun:test';
import { setupFriendsPair } from '@libs/friends/harness/setup-friends-pair';
import { actorLocalSql, focusActor, returnToTabs, signInWithGoogle } from '@libs/harness';
import type { ProductHarness } from '@libs/harness/system/harness';
import { createSpace, joinFromLobby, openSpacesTab, returnToLobby } from '@libs/spaces/harness/space-actions';
import { raw } from "@pkgs/sql";
import { openHarness } from '../harness/open-friends-harness';

const TABLES = ['auth_users', 'auth_devices', 'auth_account_devices', 'auth_external_accounts', 'friends_friendships', 'friends_requests', 'friends_blocks', 'spaces', 'spaces_users', 'spaces_open_sessions', 'profile'];

async function dump(s: ProductHarness, label: string) {
  console.log(`===== ${label} server`);
  for (const t of TABLES) {
    const rows = await s.harness.serverSql.sqlClient.query(raw(`SELECT * FROM ${t}`) as never);
    console.log(t, JSON.stringify(rows, null, 0));
  }
  for (const a of s.actors.keys()) {
    const local = actorLocalSql(s, a);
    if (local === null) continue;
    console.log(`===== ${label} device ${a}`);
    for (const t of TABLES) {
      try {
        const rows = await local.query(raw(`SELECT * FROM ${t}`) as never);
        console.log(t, JSON.stringify(rows, null, 0));
      } catch (e) { console.log(t, 'ERR', String(e)); }
    }
  }
}

test('probe', async () => {
  await using s = await openHarness('probe');
  await setupFriendsPair(s, 'alice', 'bob');
  await s.apply(signInWithGoogle, 'carol');
  await s.apply(returnToTabs, 'carol');
  await s.apply(focusActor, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(focusActor, 'bob');
  await s.apply(openSpacesTab, 'bob');
  await s.apply(joinFromLobby, 'bob', 'alice');
  await s.apply(returnToLobby, 'bob');
  await s.read(async (surf: ProductHarness) => dump(surf, 'after'));
}, 120_000);
