import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { SimFaultOptions } from '../../sim/faults';
import { RELIABLE_FAULTS } from '../../sim/faults';
import type { SyncAction } from '../../sim/scenario';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  hold,
  mutate,
  passTime,
  playActions,
  release,
  setNote,
  syncVirtualHost,
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
    await using run = await script(acmeSystem, {
      seed: 401,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(playActions, liveFaults('bob', { dropProbability: 1 }));
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost-live' });
    await run.apply(passTime, 80);

    await run.apply(release, 'bob', 'live');
    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'lost-live' });
    await expectAllNotesAgree(run, CLIENTS);
  });

  test('dup live on bob converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 402,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(
      playActions,
      liveFaults('bob', { packetReplayProbability: 1 })
    );
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'dup2' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'dup' });
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'dup2' });
  });

  test('reordered live on bob converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 403,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(
      playActions,
      liveFaults('bob', {
        latencyMeanMs: 30,
        latencyJitterMs: 40,
        reorderWindow: 8,
      })
    );
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'b' });
    await expectAllNotesAgree(run, CLIENTS);
  });

  test('asymmetric: alice reliable, bob lossy+dup+reorder', async () => {
    await using run = await script(acmeSystem, {
      seed: 404,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(playActions, [
      ...liveFaults('alice', RELIABLE_FAULTS),
      ...liveFaults('bob', {
        dropProbability: 0.4,
        packetReplayProbability: 0.5,
        reorderWindow: 5,
        latencyMeanMs: 15,
        latencyJitterMs: 25,
      }),
    ]);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await run.apply(mutate, 'bob', setNote, { id: 'n2', body: 'two' });
    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'three' });
    await run.apply(passTime, 200);

    await run.apply(release, 'alice', 'live');
    await run.apply(release, 'bob', 'live');
    await expectConverged(run);
    await expectAllNotesAgree(run, CLIENTS);
  });

  test('live chaos + sync hold then release converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 405,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(playActions, liveFaults('bob', { dropProbability: 1 }));
    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'held' });
    await run.apply(passTime, 60);

    await run.apply(release, 'bob', 'live');
    await run.apply(release, 'bob', 'sync');
    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'held' });
  });
});
