import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import offlineTrace from './fixtures/secret-choice-offline-replay.itf.json';
import { observeChoiceModel } from './secret-choices-observe';
import {
  awaitStandIn,
  finishModelGame,
  loseModelConnection,
  makeModelSecretChoice,
  modelConnectionReturns,
  playModelMove,
  prepareChoiceModel,
  reachModelRound,
  takeBackModelSide,
} from './secret-choices-world';

const actor = (picks: Picks): string => String(picks['actor']);

// The bot and a stand-in decide by themselves (`choice`): the product's own
// decision stands for it, and nobody sees which one it made.
bindQuintModel<QuintHarnessWorld>({
  model: 'secret-choices',
  traces: 128,
  maxSteps: 20,
  timeoutMs: 1_200_000,
  regressions: [
    {
      // regression: offline-secret-choice-queued
      id: 'offline-secret-choice-queued',
      title: 'An offline secret choice stays refused after reconnecting',
      seed: '0x67932',
      itf: offlineTrace,
    },
  ],
  actions: {
    init: (w) => prepareChoiceModel(w),
    makeSecretChoice: (w, picks) =>
      makeModelSecretChoice(w, actor(picks), String(picks['choice'])),
    playMove: (w) => playModelMove(w),
    reachNextRound: (w) => reachModelRound(w),
    finishGame: (w) => finishModelGame(w),
    standInTakesSide: (w, picks) => awaitStandIn(w, actor(picks)),
    takeBackSide: (w, picks) => takeBackModelSide(w, actor(picks)),
    loseConnection: (w, picks) => loseModelConnection(w, actor(picks)),
    connectionReturns: (w, picks) => modelConnectionReturns(w, actor(picks)),
  },
  observe: (w) => observeChoiceModel(w),
});
