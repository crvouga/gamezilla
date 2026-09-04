import { describe, test } from 'bun:test';

import {
  acmeSystem,
  clientIds,
  expectConverged,
  hold,
  liveNote,
  mutate,
  release,
  type SyncSurface,
  setNote,
} from '../apps/acme';

const NOTE_ID = 'n0';

const PROFILES = [
  { rowImageFanout: true, liveResendOnReconnect: false, clientCount: 2 },
  { rowImageFanout: false, liveResendOnReconnect: true, clientCount: 3 },
  { bufferOutboundLive: true, clientCount: 2 },
] as const;

/** True when the held client's optimistic body is gone or reverted. */
function bodyDrifted(clientId: string, body: string) {
  return async (s: SyncSurface): Promise<boolean> => {
    const row = await liveNote(s, clientId, NOTE_ID);
    return row === null || row.deletedAt !== null || row.body !== body;
  };
}

describe('hold window safety PBT', () => {
  test(
    'optimistic body never reverts while sync is held after local mutate',
    async () => {
      for (const [i, args] of PROFILES.entries()) {
        for (const body of ['x', 'hello world', '0123456789ab']) {
          await using s = await acmeSystem.script({ seed: 800 + i, args });
          const clientId = (await s.observe(clientIds))[0];
          if (clientId === undefined) throw new Error('no clients booted');

          await s.apply(hold, clientId, 'sync');
          await s.apply(mutate, clientId, setNote, {
            id: NOTE_ID,
            body,
            title: '',
          });
          await s.never(bodyDrifted(clientId, body), {
            forMs: 200,
            stepMs: 25,
          });

          await s.apply(release, clientId, 'sync');
          await expectConverged(s);
        }
      }
    },
    { timeout: 90_000 }
  );
});
