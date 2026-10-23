import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import pausedDaily from './fixtures/multiplayer-shared-clock-pauses.itf.json';
import {
  changeSharedClockAvailability,
  observeSharedClockGame,
  prepareSharedClockGame,
} from './matched-game-clock-recovery-world';
import { changeSpacesMatch } from './matched-game-spaces-world';
import { modelGameOf } from './model-game';

bindQuintModel<QuintHarnessWorld>({
  model: 'matched-game-clock-recovery',
  traces: 32,
  maxSteps: 12,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: multiplayer-shared-clock-pauses
      id: 'multiplayer-shared-clock-pauses',
      title: 'Shared pauses retain a daily game and refuse play until return',
      seed: '0x67932',
      itf: pausedDaily,
    },
  ],
  actions: {
    init: (w, picks) => prepareSharedClockGame(w, String(picks['chosenSpeed'])),
    playMove: (w, picks) =>
      changeSpacesMatch(w, String(picks['person']), 'move'),
    resignGame: (w, picks) =>
      changeSpacesMatch(w, String(picks['person']), 'resign'),
    secondsPass: (w, picks) =>
      w.s.apply(passMultiplayerDays, Number(picks['seconds']) * 1000),
    openFindingAnOpponent: (w, picks) =>
      w.s.apply(
        openFindingAnOpponent,
        String(picks['person']),
        modelGameOf(w).shared.id
      ),
    loseConnection: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), false),
    comeBackOnline: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), true),
    _sharedPlayStops: (w) => changeSharedClockAvailability(w, false),
    _sharedPlayReturns: (w) => changeSharedClockAvailability(w, true),
  },
  observe: observeSharedClockGame,
});
