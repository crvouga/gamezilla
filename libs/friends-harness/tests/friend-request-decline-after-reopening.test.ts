import { expect, test } from 'bun:test';
import {
  friendRequestCardVisible,
  withdrawOffered,
} from '@libs/friends-harness/friends-ui-reads';
import { requestSharingDiagnostics } from '@libs/friends-harness/request-sharing-diagnostics';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import './quint/index';

test('a request declined after repeated reopening stops being requested', async () => {
  // regression: friend-request-decline-after-reopening
  const model = 'offline-friend-requests';
  const world = quintWorld();
  const binding = quintBinding(model);
  const w = (await world.create({
    packageName: '@libs/friends',
    specUri: 'specs/friends/offline-friend-requests.qnt',
    model,
    trace: 13,
    seed: '0x67932',
    testId: 'decline-after-reopening-literal',
    title: 'Decline after repeated reopening',
  })) as QuintHarnessWorld;
  try {
    for (const action of [
      'init',
      '_loseConnection',
      '_connectionReturns',
      'reopen',
      'ask',
      'reopen',
      'reopen',
      'reopen',
      'reopen',
      'reopen',
      'decline',
    ]) {
      await binding.actions[action]!(w, { person: 'alice' });
      if (action === 'ask')
        expect(await w.s.read(friendRequestCardVisible, 'bob', 'alice')).toBe(
          true
        );
    }
    try {
      await w.s.until((s) => withdrawOffered(s, 'alice', 'bob'), {
        pred: (shown) => !shown,
      });
      expect(await w.s.read(withdrawOffered, 'alice', 'bob')).toBe(false);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n${await w.s.read(requestSharingDiagnostics)}`
      );
    }
  } finally {
    await world.dispose(w);
  }
}, 180_000);
