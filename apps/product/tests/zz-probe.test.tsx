import { describe, test } from 'bun:test';

import { defineAction } from '@pkgs/sim';
import { sql } from '@pkgs/sql';

import type { ProductSim } from '../src/sim/system/sim';
import { signInWithDev, returnToTabs } from '../src/sim/system/auth-actions';
import { openSim } from '../src/test/setup/open-sim';

const probeProfiles = defineAction({
  name: 'probeProfiles',
  act: async (s: ProductSim) => {
    await s.session.advanceTime(5000);
    await s.session.waitForIdle();
    const rows = await s.sim.serverSql.sqlClient.query(
      sql<{ id: string; username: string }>`SELECT id, username FROM profile`
    );
    console.log('PROBE server profiles:', JSON.stringify(rows));
    try {
      const applied = await s.sim.serverSql.sqlClient.query(
        sql<{ mutation_id: string; client_id: string; status: string }>`SELECT mutation_id, client_id, status FROM sync_engine_mutations_applied ORDER BY updated_at DESC LIMIT 30`
      );
      console.log('PROBE server applied:', JSON.stringify(applied));
      const aliceQueue = await s.sim.clientSql('alice')?.sqlClient.query(
        sql<{ name: string; seq: number }>`SELECT name, seq FROM sync_engine_mutations WHERE deleted_at IS NULL ORDER BY seq DESC LIMIT 10`
      );
      console.log('PROBE alice pending queue:', JSON.stringify(aliceQueue ?? null));
      const bobQueue = await s.sim.clientSql('bob')?.sqlClient.query(
        sql<{ name: string; seq: number }>`SELECT name, seq FROM sync_engine_mutations WHERE deleted_at IS NULL ORDER BY seq DESC LIMIT 10`
      );
      console.log('PROBE bob pending queue:', JSON.stringify(bobQueue ?? null));
    } catch (err) {
      console.log('PROBE applied error:', String(err).slice(0, 200));
    }
  },
});

describe('probe profiles', () => {
  test('dump server profile names', async () => {
    await using sim = await openSim('probe-profiles');
    await sim.apply(signInWithDev, 'alice');
    await sim.apply(returnToTabs, 'alice');
    await sim.apply(signInWithDev, 'bob');
    await sim.apply(returnToTabs, 'bob');
    await sim.apply(probeProfiles);
  });
});
