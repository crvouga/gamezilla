import { expect, test } from 'bun:test';
import { describeCommandWait } from '@libs/game-matchmaking-harness-ts/multiplayer-command-wait';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  syncEngineMutations,
  syncEngineMutationsApplied,
  syncEngineWriteRejections,
} from '@pkgs/sync-engine-shared-ts/tables';

// regression: refused-move-timeout-lacks-request-evidence
test('a refused opening move timeout identifies its own device and server records', async () => {
  const device = await openConformanceDb([
    syncEngineMutations,
    syncEngineWriteRejections,
  ]);
  const server = await openConformanceDb([
    syncEngineMutationsApplied,
    syncEngineWriteRejections,
  ]);
  const name = 'playMultiplayerMove';
  const requestId = 'move-game-alice-0-e2e5';
  const observe = () =>
    describeCommandWait(device, server, { name, args: { requestId } });
  const queue = (id: string, seq: number, mutation: string, request: string) =>
    device.run(sql`INSERT INTO sync_engine_mutations (id, seq, name, args, created_at)
      VALUES (${id}, ${seq}, ${mutation}, ${JSON.stringify({ requestId: request })}, ${'2026-11-26T21:37:00.000Z'})`);
  const refusal = sql`INSERT INTO sync_engine_write_rejections (id, mutation_id, code)
    VALUES (${'refusal'}, ${'move-2'}, ${'CHESS_ILLEGAL_MOVE'})`;
  try {
    await queue('other-request', 3, name, 'move-game-alice-0-e2e4');
    await queue('other-command', 4, 'resignMultiplayer', requestId);
    expect(await observe()).toContain(
      `request=${requestId} (no matching device mutation)`
    );
    await queue('move-1', 1, name, requestId);
    await queue('move-2', 2, name, requestId);
    expect(await observe()).toContain(
      'mutation=move-2 queue=pending deviceRejection=none server=unrecorded'
    );
    await server.run(sql`INSERT INTO sync_engine_mutations_applied (id, mutation_id, status)
      VALUES (${'move-2'}, ${'move-2'}, ${'rejected'})`);
    await server.run(refusal);
    expect(await observe()).toContain(
      'queue=pending deviceRejection=none server=rejected serverRejection=CHESS_ILLEGAL_MOVE'
    );
    await device.run(refusal);
    await device.run(
      sql`UPDATE sync_engine_mutations SET deleted_at = ${'2026-11-26T21:37:03.598Z'} WHERE id = ${'move-2'}`
    );
    expect(await observe()).toContain(
      'queue=retired deviceRejection=CHESS_ILLEGAL_MOVE server=rejected serverRejection=CHESS_ILLEGAL_MOVE queuedAt=2026-11-26T21:37:00.000Z retiredAt=2026-11-26T21:37:03.598Z'
    );
  } finally {
    await device.disconnect();
    await server.disconnect();
  }
});
