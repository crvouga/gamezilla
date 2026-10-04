import { repeatCustomGameAcknowledgement } from '@libs/chess-custom-game-harness/custom-game-acknowledgement';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import {
  competeConfiguration,
  configurationChoice,
  configurationInput,
  configurationReference,
} from './custom-game-configuration-choices';
import {
  configurationJoins,
  configurationLeaves,
  configurationRenames,
  configurationReopens,
  configurationSignsIn,
  configurationSignsOut,
  finishConfiguration,
} from './custom-game-configuration-effects';
import { observeConfiguration } from './custom-game-configuration-observe';
import {
  configurationLink,
  configurationPerson,
  prepareConfiguration,
} from './custom-game-configuration-world';
import heldSuccess from './fixtures/custom-game-held-success.itf.json';
import hostRefusal from './fixtures/custom-game-host-refusal-vocabulary.itf.json';
import idempotentReadiness from './fixtures/custom-game-idempotent-readiness.itf.json';
import offlineBoundary from './fixtures/custom-game-offline-boundary.itf.json';
import staleCancellation from './fixtures/custom-game-stale-cancellation.itf.json';
import hostJoinStaleFanout from './fixtures/space-host-join-stale-fanout.itf.json';
import hostLeaveRemount from './fixtures/space-host-leave-remount.itf.json';

function choose(command: string) {
  return (w: QuintHarnessWorld, picks: Picks): Promise<void> =>
    configurationChoice(
      w,
      String(picks['actor']),
      configurationInput(w, command, picks)
    );
}

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game',
  traces: 256,
  maxSteps: 24,
  inductiveInvariant: '_inductive',
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: space-host-join-stale-fanout
      id: 'space-host-join-stale-fanout',
      title: 'Reconnecting to an ended space settles its subscriptions',
      seed: '0x67932',
      itf: hostJoinStaleFanout,
    },
    {
      // regression: space-host-leave-remount
      id: 'space-host-leave-remount',
      title: 'A host leaving keeps their confirmation outcome visible',
      seed: '0x67932',
      itf: hostLeaveRemount,
    },
    {
      // regression: custom-game-host-refusal-vocabulary
      id: 'custom-game-host-refusal-vocabulary',
      title: 'A host-only refusal preserves the observed authority reason',
      seed: '0x67932',
      itf: hostRefusal,
    },
    {
      // regression: custom-game-held-success
      id: 'custom-game-held-success',
      title: 'A second choice confirms while earlier success remains visible',
      seed: '0x67932',
      itf: heldSuccess,
    },
    {
      // regression: custom-game-stale-cancellation
      id: 'custom-game-stale-cancellation',
      title: 'Earlier choices cannot cancel a newly configured game',
      seed: '0x67932',
      itf: staleCancellation,
    },
    {
      // regression: custom-game-idempotent-readiness
      id: 'custom-game-idempotent-readiness',
      title: 'Withdrawing readiness twice does not become ready',
      seed: '0x67932',
      itf: idempotentReadiness,
    },
    {
      // regression: custom-game-offline-boundary
      id: 'custom-game-offline-boundary',
      title: 'A modified offline device cannot reach the game boundary',
      seed: '0x67932',
      itf: offlineBoundary,
    },
  ],
  actions: {
    init: (w, picks) => prepareConfiguration(w, String(picks['beginning'])),
    createGame: choose('create'),
    rematch: choose('rematch'),
    takeSide: choose('take'),
    assignBot: choose('bot'),
    openSide: choose('open'),
    closeSide: choose('close'),
    invite: choose('invite'),
    acceptSide: choose('accept'),
    declineSide: choose('decline'),
    revokeSide: choose('revoke'),
    claimSide: choose('claim'),
    releaseSide: choose('release'),
    becomeReady: choose('ready'),
    becomeUnready: choose('unready'),
    swapSides: choose('swap'),
    chooseClock: choose('clock'),
    startGame: choose('start'),
    cancelGame: choose('cancel'),
    resignGame: choose('resign'),
    offerDraw: choose('offer'),
    acceptDraw: choose('agree'),
    declineDraw: choose('reject'),
    _finishGame: (w, picks) => finishConfiguration(w, String(picks['result'])),
    _loseConnection: async (w, picks) => {
      const actor = String(picks['actor']);
      await w.s.apply(partition, actor);
      (w.memo.get('configuration-offline') as Set<string>).add(actor);
    },
    _connectionReturns: async (w, picks) => {
      const actor = String(picks['actor']);
      await w.s.apply(restoreActorConnection, actor);
      (w.memo.get('configuration-offline') as Set<string>).delete(actor);
    },
    _reopenApp: (w, picks) => configurationReopens(w, String(picks['actor'])),
    _repeatAcknowledged: (w) =>
      w.s.apply(
        repeatCustomGameAcknowledgement,
        configurationLink(w).split('/space/')[1] ?? '',
        configurationPerson(w, 'alice')
      ),
    _staleChoice: async (w, picks) => {
      const actor = String(picks['actor']);
      const reference = await configurationReference(w, actor);
      await configurationChoice(
        w,
        actor,
        configurationInput(w, String(picks['command']), picks),
        { ...reference, gameId: 'earlier-custom-game' }
      );
    },
    _competingChoices: competeConfiguration,
    _attemptChoice: (w, picks) =>
      configurationChoice(
        w,
        String(picks['actor']),
        configurationInput(w, String(picks['command']), picks)
      ),
    _personLeaves: (w, picks) => configurationLeaves(w, String(picks['actor'])),
    _personJoins: (w, picks) => configurationJoins(w, String(picks['actor'])),
    _signOut: (w, picks) => configurationSignsOut(w, String(picks['actor'])),
    _signIn: (w, picks) => configurationSignsIn(w, String(picks['actor'])),
    _usernameChanges: (w, picks) =>
      configurationRenames(w, String(picks['actor'])),
  },
  observe: observeConfiguration,
});
