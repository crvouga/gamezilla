import { TEST_LOCAL_SQL_GLOBAL } from '@libs/app-root-shared/test-local-sql';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import { waitUntil } from '@pkgs/ui-testing-root-shared/wait';
import type { ActorCheckpointPort } from './client-checkpoint';

type View = { evaluate(script: string): Promise<unknown> };
const HOOK = `globalThis[${JSON.stringify(TEST_LOCAL_SQL_GLOBAL)}]`;

async function writesSettled(view: View): Promise<void> {
  await waitUntil(
    async () => {
      const raw = await view.evaluate(
        `${HOOK}.query(['SELECT COUNT(*) AS pending FROM sync_engine_mutations WHERE deleted_at IS NULL'], [])`
      );
      if (typeof raw !== 'string')
        throw new Error('Device pending writes unavailable');
      const rows = JSON.parse(raw) as { pending: unknown }[];
      const pending = rows[0]?.pending;
      if (pending === 0 || pending === '0') return true;
      throw new Error(`Device still has ${String(pending)} pending writes`);
    },
    {
      now: wallClock.now,
      timers: wallTimers,
      timeoutMs: 20_000,
      description: 'checkpoint writes to reach the server',
    }
  );
}

/** The browser's own SQL and durable storage, rather than a headless client. */
export function webviewCheckpoint(
  view: View,
  openLink: (path: string) => Promise<void>
): ActorCheckpointPort {
  const ready = () =>
    waitUntil(() => view.evaluate(`Boolean(${HOOK})`), {
      now: wallClock.now,
      timers: wallTimers,
      timeoutMs: 20_000,
      description: 'the device database',
    });
  return {
    async capture() {
      await ready();
      await writesSettled(view);
      const sql = await view.evaluate(`${HOOK}.dump()`);
      if (typeof sql !== 'string')
        throw new Error('Device SQL dump unavailable');
      const kv = await view.evaluate(`JSON.stringify({
        local: JSON.stringify(localStorage),
        session: JSON.stringify(sessionStorage),
        path: location.pathname + location.search
      })`);
      if (typeof kv !== 'string')
        throw new Error('Device storage dump unavailable');
      return {
        sql: new TextEncoder().encode(sql),
        kv: JSON.parse(kv) as Record<string, string>,
      };
    },
    async restore(checkpoint) {
      const path = checkpoint.kv['path'];
      if (path === undefined || !path.startsWith('/') || path.startsWith('//'))
        throw new Error('Device checkpoint lacks a local app path');
      const dump = JSON.parse(new TextDecoder().decode(checkpoint.sql));
      const local = JSON.parse(checkpoint.kv['local'] ?? '');
      const session = JSON.parse(checkpoint.kv['session'] ?? '');
      await view.evaluate(`(() => {
        for (const [storage, entries] of [[localStorage, ${JSON.stringify(local)}], [sessionStorage, ${JSON.stringify(session)}]]) {
          storage.clear();
          for (const [key, value] of Object.entries(entries)) storage.setItem(key, value);
        }
      })()`);
      await openLink(path);
      await ready();
      // Parsing the host's JSON keeps it data when transported into the page.
      await view.evaluate(
        `${HOOK}.restore(${JSON.stringify(dump)}).then(() => true)`
      );
      await openLink(path);
      await ready();
    },
  };
}
