import { test } from 'bun:test';
import { actorLocalSql, appleDeletesAccount, connectSignInMethod, focusActor, openAccount, returnToTabs, signInWithApple, signInWithGoogle, signInWithGoogleAsAccount, signOut } from '@libs/harness';
import type { ProductHarness } from '@libs/harness/system/harness';
import { raw } from '@pkgs/sql';
import { openHarness } from '../harness/open-profile-harness';

async function tables(s: ProductHarness): Promise<string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(raw<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE 'idp%' OR table_name LIKE 'auth%' OR table_name = 'profile') ORDER BY table_name`));
  return rows.map((r) => r.table_name);
}

async function dump(s: ProductHarness, label: string) {
  console.log(`===== ${label} server`);
  const ts = await tables(s);
  for (const t of ts) {
    const rows = await s.harness.serverSql.sqlClient.query(raw(`SELECT * FROM ${t}`) as never);
    console.log(t, JSON.stringify(rows, null, 0));
  }
  for (const a of s.actors.keys()) {
    const local = actorLocalSql(s, a);
    if (local === null) continue;
    console.log(`===== ${label} device ${a}`);
    for (const t of ['auth_users', 'auth_devices', 'auth_account_devices', 'auth_external_accounts', 'profile']) {
      try {
        const rows = await local.query(raw(`SELECT * FROM ${t}`) as never);
        console.log(t, JSON.stringify(rows, null, 0));
      } catch (e) { console.log(t, 'ERR', String(e)); }
    }
  }
}

test('probe', async () => {
  await using s = await openHarness('probe');
  await s.apply(focusActor, 'guest');
  await s.apply(signInWithApple, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(connectSignInMethod, 'alice', 'google');
  await s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
  await s.apply(returnToTabs, 'alice_phone');
  await s.apply(openAccount, 'alice_phone');
  await s.apply(signOut, 'alice_phone');
  await s.apply(signInWithApple, 'bob');
  await s.apply(returnToTabs, 'bob');
  await s.apply(appleDeletesAccount, 'bob');
  await s.until(async () => true, { maxMs: 3000 }).catch(() => null);
  await s.read(async (surf: ProductHarness) => dump(surf, 'after'));
}, 120_000);
