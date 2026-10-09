import { expect, test } from 'bun:test';
import {
  friendRequestCardVisible,
  withdrawOffered,
} from '@libs/friends-harness/friends-ui-reads';
import { requestSharingDiagnostics } from '@libs/friends-harness/request-sharing-diagnostics';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import './quint/index';

test('a refused offline request disappears after reopening before reconnecting', async () => {
  // regression: friend-request-rejected-insert-after-reopen
  const world = quintWorld();
  const model = 'offline-friend-requests';
  const binding = quintBinding(model);
  const w = (await world.create({
    packageName: '@libs/friends',
    specUri: 'specs/friends/offline-friend-requests.qnt',
    model,
    trace: 20,
    seed: '0x67932',
    testId: 'rejected-insert-after-reopen',
    title: 'Refused offline request after reopening',
  })) as QuintHarnessWorld;
  try {
    for (const action of [
      'init',
      '_loseConnection',
      'ask',
      'reopen',
      'blockPerson',
      'reopen',
      '_connectionReturns',
    ]) {
      await binding.actions[action]!(w, { person: 'alice' });
    }
    try {
      await w.s.until((s) => withdrawOffered(s, 'alice', 'bob'), {
        pred: (shown) => !shown,
      });
      expect(await w.s.read(withdrawOffered, 'alice', 'bob')).toBe(false);
      for (const action of [
        '_loseConnection',
        'unblockPerson',
        '_connectionReturns',
        '_loseConnection',
        'ask',
      ]) {
        await binding.actions[action]!(w, { person: 'alice' });
      }
      expect(await w.s.read(withdrawOffered, 'alice', 'bob')).toBe(true);
      expect(await w.s.read(friendRequestCardVisible, 'bob', 'alice')).toBe(
        false
      );
      await binding.actions['_connectionReturns']!(w, { person: 'alice' });
      await w.s.until((s) => friendRequestCardVisible(s, 'bob', 'alice'));
      expect(await w.s.read(friendRequestCardVisible, 'bob', 'alice')).toBe(
        true
      );
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n${await w.s.read(requestSharingDiagnostics)}`
      );
    }
  } finally {
    await world.dispose(w);
  }
}, 180_000);
