import { expect, test } from 'bun:test';
import { OpfsSahPoolBackend } from '@pkgs/sql-client-sqlite-web-client-ts/opfs-sah-pool-backend';
import type { Sqlite3Static } from '@pkgs/sql-client-sqlite-web-shared-ts/oo1-sql-client';

// regression: opfs-close-keeps-pool-handles
test('closing the database releases pool handles before the next open reacquires them', async () => {
  const events: string[] = [];
  class Database {
    private opened = true;
    constructor() {
      events.push('open');
    }
    isOpen() {
      return this.opened;
    }
    close() {
      this.opened = false;
      events.push('close');
    }
  }
  const util = {
    OpfsSAHPoolDb: Database,
    pauseVfs: () => {
      events.push('pause');
    },
    unpauseVfs: () => {
      events.push('unpause');
      return Promise.resolve();
    },
  };
  const sqlite = {
    installOpfsSAHPoolVfs: () => Promise.resolve(util),
  } as unknown as Sqlite3Static;
  const backend = new OpfsSahPoolBackend(sqlite);
  const first = await backend.open('user_740c685e6cc0');
  await first.db.disconnect();
  expect(events).toEqual(['open', 'close', 'pause']);
  const second = await backend.open('user_740c685e6cc0');
  expect(events).toEqual(['open', 'close', 'pause', 'unpause', 'open']);
  await second.db.disconnect();
});
