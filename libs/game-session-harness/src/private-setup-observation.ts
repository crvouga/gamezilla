/**
 * What reaches a person of a game with private setups, read where it
 * leaves the platform rather than where a screen draws it: every entry the
 * space's room sends their connection when it catches up from the start,
 * and every row their device's own database holds. The shared privacy suite
 * holds each to carrying no setup but the person's own.
 */

import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { ensureActor } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared/wire';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import { readCustomGameIdentity } from './custom-game-identity';

/**
 * Every entry the space's room sends `actor` when their connection asks
 * for its history from the start, as it travels: what a reconnecting or
 * newly joining device of theirs receives.
 */
export async function roomHistorySentTo(
  s: ProductHarness,
  actor: string,
  spaceId: string
): Promise<string> {
  await ensureActor(s, actor);
  const env = await s.harness.client(actor);
  if (env.room === undefined) throw new Error(`${actor} has no room transport`);
  const installId = env.secureStorage.getValue(DEVICE_ID_KEY);
  if (installId === null) throw new Error(`${actor} has no install identity`);
  const transport = env.room({
    topic: `space:${spaceId}`,
    module: 'space',
    identity: await readCustomGameIdentity(s, actor),
    installId,
    clientId: env.createId(),
    apiUrl: '',
    timers: env.timers,
    random: env.random,
    getSessionToken: () => null,
  });
  const frames: string[] = [];
  let welcomed: (value: void) => void = () => {};
  const welcome = new Promise<void>((resolve) => {
    welcomed = resolve;
  });
  const unsubscribe = transport.subscribe((received) => {
    frames.push(JSON.stringify(received));
    if (parseServerToClientWire(received)?.kind === ROOM_WIRE_KIND.welcome)
      welcomed();
  });
  try {
    await transport.connect();
    transport.sendJson({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.sync,
      fromSeq: 0,
    });
    for (let turn = 0; turn < 200 && frames.length === 0; turn += 1) {
      await s.session.advanceTime(10);
      await s.harness.drainServerFetch();
    }
    await Promise.race([welcome, s.session.advanceTime(1000)]);
    return frames.join('\n');
  } finally {
    unsubscribe();
    transport.destroy();
  }
}

/** Every row of every table `actor`'s device holds, as one text. */
export async function deviceRowsOf(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const db = actorLocalSql(s, actor);
  if (db === null) return '';
  const tables = await db.query(sql<{ name: string }>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
  const rows: unknown[] = [];
  for (const table of tables)
    rows.push(
      ...(await db.query(
        sql<Record<string, unknown>>`SELECT * FROM ${raw(`"${table.name}"`)}`
      ))
    );
  return JSON.stringify(rows);
}
