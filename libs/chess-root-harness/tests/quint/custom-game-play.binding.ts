import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { setCustomGameAvailability } from '@libs/chess-custom-game-harness/custom-game-availability';
import { readCustomGameSeconds } from '@libs/chess-custom-game-harness/custom-game-clocks';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import {
  CUSTOM_MODEL_OBSERVER,
  CUSTOM_MODEL_PEOPLE,
  customModelGame,
  playCustomModelMove,
  prepareCustomGameModel,
  readCustomModelShown,
  repeatCustomModelMove,
} from './custom-game-model-world';
import pauseObservation from './fixtures/custom-game-binding-omits-clock-pause.itf.json';
import observationTrace from './fixtures/custom-game-observation-spends-time.itf.json';
import offlineObserver from './fixtures/custom-game-offline-observer-hides-pause.itf.json';
import partitionTrace from './fixtures/custom-game-partition-spends-time.itf.json';
import absencePause from './fixtures/custom-game-pause-counts-as-absence.itf.json';
import sharedPause from './fixtures/custom-game-shared-pause-spends-clock.itf.json';

/** The model's watcher: in the space, on neither side. */
const PLAY_WATCHER = 'carol';
/** The model's starting time, in quarter minutes, which an untimed game keeps. */
const UNTIMED_QUARTERS = 4;

bindQuintModel<QuintHarnessWorld>({
  model: 'custom-game-play',
  traces: 32,
  maxSteps: 16,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: custom-game-pause-counts-as-absence
      id: 'custom-game-pause-counts-as-absence',
      title: 'Shared interruption does not count as the opponent staying away',
      seed: '0x67932',
      itf: absencePause,
    },
    {
      // regression: custom-game-offline-observer-hides-pause
      id: 'custom-game-offline-observer-hides-pause',
      title:
        'A connected watcher observes a shared pause while the creator is offline',
      seed: '0x67932',
      itf: offlineObserver,
    },
    {
      // regression: custom-game-shared-pause-spends-clock
      id: 'custom-game-shared-pause-spends-clock',
      title:
        'A shared pause retains a timed game through a whole clock allowance',
      seed: '0x67932',
      itf: sharedPause,
    },
    {
      // regression: custom-game-binding-omits-clock-pause
      id: 'custom-game-binding-omits-clock-pause',
      title: 'A newly opened game reports whether its clocks are paused',
      seed: '0x67932',
      itf: pauseObservation,
    },
    // regression: custom-game-observation-spends-time
    {
      id: 'custom-game-observation-spends-time',
      title: 'Observing a game spends no participant time',
      seed: '0x67932',
      itf: observationTrace,
    },
    // regression: custom-game-partition-spends-time
    {
      id: 'custom-game-partition-spends-time',
      title: 'An offline watcher retains the board before the next heartbeat',
      seed: '0x67932',
      itf: partitionTrace,
    },
  ],
  actions: {
    init: (w, picks) =>
      prepareCustomGameModel(w, {
        timed: picks['timed'] === true,
        watchers: [PLAY_WATCHER],
      }),
    playCustomMove: (w, picks) =>
      playCustomModelMove(w, String(picks['actor'])),
    resignCustomGame: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'resign',
      }),
    cancelCustomGame: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'cancel',
      }),
    claimWin: (w, picks) =>
      w.s.apply(changeCustomGame, String(picks['actor']), {
        operation: 'claimWin',
      }),
    customTimePasses: (w, picks) =>
      w.s.advanceTime(Number(picks['quarters']) * 15_000),
    _illegalMove: async (w, picks) => {
      const actor = String(picks['actor']);
      const game = await customModelGame(w, actor);
      await w.s.apply(changeCustomGame, actor, {
        operation: 'move',
        uci: 'e2e5',
        ply: game.moves.length,
      });
    },
    _repeatMove: repeatCustomModelMove,
    _changeStartedGame: (w) =>
      w.s.apply(changeCustomGame, 'alice', {
        operation: 'clock',
        minutes: 5,
        increment: 2,
      }),
    _loseConnection: (w, picks) => w.s.apply(partition, String(picks['actor'])),
    _connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['actor'])),
    _sharedPlayStops: (w) =>
      w.s.apply(
        setCustomGameAvailability,
        String(w.memo.get('custom-link')).slice('/space/'.length),
        false
      ),
    _sharedPlayReturns: (w) =>
      w.s.apply(
        setCustomGameAvailability,
        String(w.memo.get('custom-link')).slice('/space/'.length),
        true
      ),
  },
  observe: async (w) => {
    const game = await customModelGame(w, CUSTOM_MODEL_OBSERVER);
    const clockLeft = new Map<string, number>();
    for (const side of ['white', 'black'] as const)
      clockLeft.set(
        side,
        // An untimed game shows no clock and never spends its starting time.
        game.minutes === 0
          ? UNTIMED_QUARTERS
          : (await w.quiet.read(
              readCustomGameSeconds,
              CUSTOM_MODEL_OBSERVER,
              side
            )) / 15
      );
    return {
      ply: game.moves.length,
      sideToMove: game.turn,
      clocksPaused:
        game.minutes > 0 &&
        game.status === 'active' &&
        game.turnStartedAt === null,
      clockLeft,
      playShown: await readCustomModelShown(w, [
        ...CUSTOM_MODEL_PEOPLE,
        PLAY_WATCHER,
      ]),
    };
  },
});
