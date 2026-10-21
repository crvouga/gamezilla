import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { observeSetupModel } from './private-setup-observe';
import {
  awaitBotAnswer,
  changeSetup,
  chooseSetup,
  customChoice,
  matchedCommand,
  playSetupMove,
  prepareSetupModel,
  setupConnection,
  setupKind,
  setupSecondsPass,
} from './private-setup-world';

const actor = (picks: Picks): string => String(picks['actor']);

/**
 * A choice only the custom game offers (readiness, starting, a rematch);
 * a matched game has no control for it, so its person makes none.
 */
function inCustomGame(operation: 'ready' | 'unready' | 'start' | 'rematch') {
  return async (w: QuintHarnessWorld, picks: Picks) => {
    if (setupKind(w) !== 'custom') return;
    await customChoice(w, actor(picks), { operation });
    // A bot on the first side moves at once when the game starts.
    if (operation === 'start') await awaitBotAnswer(w);
  };
}

/** A command only the matched game offers (abort); a custom game has no control for it. */
function inMatchedGame(name: string) {
  return async (w: QuintHarnessWorld, picks: Picks) => {
    if (setupKind(w) === 'matched') await matchedCommand(w, actor(picks), name);
  };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'private-setup',
  // Most walks stay with the game being set up; walks of 48 steps draw a
  // few that reach play. Nightly replays every trace in one part.
  traces: 63,
  maxSteps: 48,
  timeoutMs: 900_000,
  // The model counts seconds (choosing, each first move): settling in small
  // steps keeps the product's time with the model's.
  settleStepMs: 20,
  actions: {
    init: (w, picks) => prepareSetupModel(w, String(picks['beginning'])),
    changePrivateSetup: (w, picks) =>
      changeSetup(w, actor(picks), String(picks['setup'])),
    becomeReady: inCustomGame('ready'),
    becomeUnready: inCustomGame('unready'),
    choosePrivateSetup: async (w, picks) => {
      // A custom game has no setup to choose apart from becoming ready.
      if (setupKind(w) === 'matched') await chooseSetup(w, actor(picks));
    },
    startGame: inCustomGame('start'),
    playMove: async (w, picks) => {
      await playSetupMove(w, actor(picks));
      await awaitBotAnswer(w);
    },
    secondsPass: (w, picks) => setupSecondsPass(w, Number(picks['seconds'])),
    abortGame: inMatchedGame('abortMultiplayer'),
    resignGame: async (w, picks) => {
      if (setupKind(w) === 'custom')
        await customChoice(w, actor(picks), { operation: 'resign' });
      else await matchedCommand(w, actor(picks), 'resignMultiplayer');
    },
    rematch: inCustomGame('rematch'),
    loseConnection: (w, picks) => setupConnection(w, actor(picks), false),
    // A move that waited for the connection counts, and a bot answers it.
    connectionReturns: async (w, picks) => {
      await setupConnection(w, actor(picks), true);
      await awaitBotAnswer(w);
    },
  },
  observe: observeSetupModel,
});
