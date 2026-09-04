import { describe, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  exampleSystem,
  expectAllNotesAgree,
  expectInSync,
  expectLiveNoteAt,
  mutate,
  netSet,
  pauseNetwork,
  RELIABLE_FAULTS,
  resumeNetwork,
  setNote,
} from '@pkgs/sync-engine/sim';

const CLIENTS = ['alice', 'bob'] as const;

describe('live loss dup reorder still staysInSync', () => {
  test('lossy live on bob still staysInSync after clear', async () => {
    await using s = await exampleSystem.run({
      seed: 401,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectInSync(s);

    await s.apply(netSet, 'bob', 'live', { dropProbability: 1 });
    await s.advanceTime(10);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost-live' });
    await s.advanceTime(80);

    await s.apply(resumeNetwork, 'bob', 'live');
    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await expectInSync(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'lost-live' });
    await expectAllNotesAgree(s, CLIENTS);
  });

  test('dup live on bob staysInSync', async () => {
    await using s = await exampleSystem.run({
      seed: 402,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(netSet, 'bob', 'live', { packetReplayProbability: 1 });
    await s.advanceTime(10);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'dup2' });
    await expectInSync(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'dup' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'dup2' });
  });

  test('reordered live on bob staysInSync', async () => {
    await using s = await exampleSystem.run({
      seed: 403,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(netSet, 'bob', 'live', {
      latencyMeanMs: 30,
      latencyJitterMs: 40,
      reorderWindow: 8,
    });
    await s.advanceTime(10);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectInSync(s);
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'b' });
    await expectAllNotesAgree(s, CLIENTS);
  });

  test('asymmetric: alice reliable, bob lossy+dup+reorder', async () => {
    await using s = await exampleSystem.run({
      seed: 404,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(netSet, 'alice', 'live', RELIABLE_FAULTS);
    await s.advanceTime(10);
    await s.apply(netSet, 'bob', 'live', {
      dropProbability: 0.4,
      packetReplayProbability: 0.5,
      reorderWindow: 5,
      latencyMeanMs: 15,
      latencyJitterMs: 25,
    });
    await s.advanceTime(10);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'two' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'three' });
    await s.advanceTime(200);

    await s.apply(resumeNetwork, 'alice', 'live');
    await s.apply(resumeNetwork, 'bob', 'live');
    await expectInSync(s);
    await expectAllNotesAgree(s, CLIENTS);
  });

  test('live chaos + sync hold then release staysInSync', async () => {
    await using s = await exampleSystem.run({
      seed: 405,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectInSync(s);

    await s.apply(netSet, 'bob', 'live', { dropProbability: 1 });
    await s.advanceTime(10);
    await s.apply(pauseNetwork, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'held' });
    await s.advanceTime(60);

    await s.apply(resumeNetwork, 'bob', 'live');
    await s.apply(resumeNetwork, 'bob', 'sync');
    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await expectInSync(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'held' });
  });
});
