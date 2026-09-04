import { describe, test } from 'bun:test';
import type { SimFaultOptions } from '../../sim/faults';
import { RELIABLE_FAULTS } from '../../sim/faults';
import type { SyncAction } from '../../sim/scenario';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  hold,
  mutate,
  playActions,
  release,
  setNote,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

const CLIENTS = ['alice', 'bob'] as const;

/** One `setFaults` step for a node's live edge. */
function liveFaults(
  nodeId: string,
  faults: Partial<SimFaultOptions>
): readonly SyncAction[] {
  return [{ kind: 'setFaults', nodeId, traffic: 'live', faults }];
}

describe('live loss dup reorder still converges', () => {
  test('lossy live on bob still converges after clear', async () => {
    await using s = await acmeSystem.script({
      seed: 401,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(playActions, liveFaults('bob', { dropProbability: 1 }));
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost-live' });
    await s.elapse(80);

    await s.apply(release, 'bob', 'live');
    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'lost-live' });
    await expectAllNotesAgree(s, CLIENTS);
  });

  test('dup live on bob converges', async () => {
    await using s = await acmeSystem.script({
      seed: 402,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(
      playActions,
      liveFaults('bob', { packetReplayProbability: 1 })
    );
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'dup2' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'dup' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'dup2' });
  });

  test('reordered live on bob converges', async () => {
    await using s = await acmeSystem.script({
      seed: 403,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(
      playActions,
      liveFaults('bob', {
        latencyMeanMs: 30,
        latencyJitterMs: 40,
        reorderWindow: 8,
      })
    );
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'b' });
    await expectAllNotesAgree(s, CLIENTS);
  });

  test('asymmetric: alice reliable, bob lossy+dup+reorder', async () => {
    await using s = await acmeSystem.script({
      seed: 404,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(playActions, [
      ...liveFaults('alice', RELIABLE_FAULTS),
      ...liveFaults('bob', {
        dropProbability: 0.4,
        packetReplayProbability: 0.5,
        reorderWindow: 5,
        latencyMeanMs: 15,
        latencyJitterMs: 25,
      }),
    ]);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'two' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'three' });
    await s.elapse(200);

    await s.apply(release, 'alice', 'live');
    await s.apply(release, 'bob', 'live');
    await expectConverged(s);
    await expectAllNotesAgree(s, CLIENTS);
  });

  test('live chaos + sync hold then release converges', async () => {
    await using s = await acmeSystem.script({
      seed: 405,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(playActions, liveFaults('bob', { dropProbability: 1 }));
    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'held' });
    await s.elapse(60);

    await s.apply(release, 'bob', 'live');
    await s.apply(release, 'bob', 'sync');
    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'held' });
  });
});
