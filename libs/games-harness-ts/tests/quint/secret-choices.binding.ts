import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { observeChoiceModel } from './secret-choices-observe';
import {
  awaitOwnSecretChoice,
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
const choice = (picks: Picks): string => String(picks['choice']);

/** The model's people by side: who a stand-in plays for. */
const PERSON_OF_SIDE: Readonly<Record<string, string>> = {
  first: 'alice',
  second: 'bob',
  third: 'carol',
};

bindQuintModel<QuintHarnessWorld>({
  model: 'secret-choices',
  traces: 8,
  maxSteps: 12,
  timeoutMs: 600_000,
  actions: {
    init: (w) => prepareChoiceModel(w),
    makeSecretChoice: (w, picks) =>
      makeModelSecretChoice(w, actor(picks), choice(picks)),
    // The bot and a stand-in choose by themselves: the step is when they have.
    botPlays: (w, picks) => awaitOwnSecretChoice(w, 'fourth', choice(picks)),
    standInPlays: (w, picks) =>
      awaitOwnSecretChoice(w, String(picks['side']), choice(picks)),
    playMove: (w) => playModelMove(w),
    reachNextRound: (w) => reachModelRound(w),
    finishGame: (w) => finishModelGame(w),
    standInTakesSide: (w, picks) => awaitStandIn(w, actor(picks)),
    takeBackSide: (w, picks) => takeBackModelSide(w, actor(picks)),
    loseConnection: (w, picks) => loseModelConnection(w, actor(picks)),
    connectionReturns: (w, picks) => modelConnectionReturns(w, actor(picks)),
  },
  observe: (w) => observeChoiceModel(w, PERSON_OF_SIDE),
});
