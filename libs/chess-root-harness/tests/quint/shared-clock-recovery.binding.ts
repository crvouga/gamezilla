import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  changeSharedClockAvailability,
  playSharedClockMove,
  prepareSharedClockGame,
  resignSharedClockGame,
} from '@libs/chess-root-harness/shared-clock-model';
import { observeSharedClockGame } from '@libs/chess-root-harness/shared-clock-observe';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness/multiplayer-time';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import pausedDaily from './fixtures/multiplayer-shared-clock-pauses.itf.json';

bindQuintModel<QuintHarnessWorld>({
  model: 'shared-clock-recovery',
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
    init: (w, picks) =>
      w.s.apply(prepareSharedClockGame, String(picks['chosenSpeed'])),
    playMove: (w, picks) =>
      w.s.apply(playSharedClockMove, String(picks['person'])),
    resignPlay: (w, picks) =>
      w.s.apply(resignSharedClockGame, String(picks['person'])),
    multiplayerTimePasses: (w, picks) =>
      w.s.apply(passMultiplayerDays, Number(picks['seconds']) * 1000),
    openMultiplayer: (w, picks) =>
      w.s.apply(openMultiplayerChess, String(picks['person'])),
    loseConnection: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), false),
    comeBackOnline: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), true),
    _sharedPlayStops: (w) => w.s.apply(changeSharedClockAvailability, false),
    _sharedPlayReturns: (w) => w.s.apply(changeSharedClockAvailability, true),
  },
  observe: (w) => w.quiet.read(observeSharedClockGame),
});
