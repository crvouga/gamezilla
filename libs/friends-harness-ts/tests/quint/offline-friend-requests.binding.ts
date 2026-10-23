import {
  requestRefusalShown,
  requestWaitingToShare,
} from '@libs/friends-harness-ts/friend-request-feedback-reads';
import {
  declineFriendRequest,
  unblockFriend,
} from '@libs/friends-harness-ts/friends-actions';
import {
  friendRequestCardVisible,
  withdrawOffered,
} from '@libs/friends-harness-ts/friends-ui-reads';
import {
  blockPerson,
  openKnownPersonProfile,
  openPersonFromSearch,
  sendRequestFromProfile,
} from '@libs/friends-harness-ts/person-actions';
import {
  partition,
  restartApp,
  restoreNetwork,
} from '@libs/harness-ts/actions';
import {
  claimActorUsername,
  returnToTabs,
  signInWithGoogle,
} from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import declineAfterReopening from './fixtures/friend-request-decline-after-reopening.itf.json';
import localRefusalReopening from './fixtures/friend-request-local-refusal-lost-on-reopen.itf.json';
import rejectedInsertReopening from './fixtures/friend-request-rejected-insert-after-reopen.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'offline-friend-requests',
  inductiveInvariant: '_inductive',
  inferPolymorphicTypes: false,
  traces: 32,
  maxSteps: 12,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: friend-request-rejected-insert-after-reopen
      id: 'friend-request-rejected-insert-after-reopen',
      title: 'A refused request is removed after reopening before reconnecting',
      seed: '0x67932',
      itf: rejectedInsertReopening,
    },
    {
      // regression: friend-request-local-refusal-lost-on-reopen
      id: 'friend-request-local-refusal-lost-on-reopen',
      title: 'A known decline refusal remains visible after reopening',
      seed: '0x67932',
      itf: localRefusalReopening,
    },
    {
      // regression: friend-request-decline-after-reopening
      id: 'friend-request-decline-after-reopening',
      title: 'A request declined after the asker reopens stops being requested',
      seed: '0x67932',
      itf: declineAfterReopening,
    },
  ],
  actions: {
    init: async (w) => {
      for (const actor of ['alice', 'bob']) {
        await w.s.apply(signInWithGoogle, actor);
        await w.s.apply(claimActorUsername, actor);
        await w.s.apply(returnToTabs, actor);
      }
      await w.s.apply(openPersonFromSearch, 'bob', 'alice');
      await w.s.apply(openPersonFromSearch, 'alice', 'bob');
    },
    ask: async (w) => {
      await w.s.apply(sendRequestFromProfile, 'alice', 'bob');
      await w.s.advanceTime(1_000);
    },
    decline: async (w) => {
      await w.s.apply(backToTabs, 'bob');
      await w.s.apply(declineFriendRequest, 'bob', 'alice');
      await w.s.advanceTime(1_000);
    },
    blockPerson: async (w) => {
      await w.s.apply(openKnownPersonProfile, 'bob', 'alice');
      await w.s.apply(blockPerson, 'bob', 'alice');
    },
    unblockPerson: async (w) => {
      await w.s.apply(backToTabs, 'bob');
      await w.s.apply(unblockFriend, 'bob', 'alice');
    },
    _loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
      await w.s.advanceTime(1_000);
    },
    _connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.advanceTime(1_000);
    },
    reopen: async (w) => {
      await w.s.apply(restartApp, 'alice');
    },
  },
  observe: async (w) => {
    const alice = await w.quiet.read(withdrawOffered, 'alice', 'bob');
    const waitingToShare = await w.quiet.read(requestWaitingToShare, 'alice');
    const requestRefused = await w.quiet.read(
      requestRefusalShown,
      'alice',
      'bob'
    );
    const bob = await w.quiet.read(friendRequestCardVisible, 'bob', 'alice');
    return {
      requestShown: new Map([
        ['alice', alice],
        ['bob', bob],
      ]),
      waitingToShare,
      requestRefused,
    };
  },
});
