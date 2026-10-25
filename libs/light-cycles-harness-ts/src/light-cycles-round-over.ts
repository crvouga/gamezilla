import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { restoreLightCyclesArena } from './light-cycles-arena-fixture';
import { lightCyclesBoardShown } from './light-cycles-board-view';
import { lightCyclesObserver, startedLightCycles } from './light-cycles-lineup';

const SHOWN_MS = 2000;

/**
 * Round `round` has just ended, drawn, every rider crashed where it was:
 * the game resumes from its saved live state at that round's result.
 */
export const endRoundDrawn = scenarioAction({
  name: 'endRoundDrawn',
  act: async (s, round: number) => {
    await startedLightCycles(s);
    await restoreLightCyclesArena(s, (saved) => ({
      ...saved,
      phase: 'round-over',
      phaseTick: 0,
      round,
      riders: saved.riders.map((rider) => ({
        ...rider,
        alive: false,
        turns: [],
      })),
      crashes: saved.riders.map((rider) => ({
        seat: rider.seat,
        x: rider.x,
        y: rider.y,
        cause: 'wall' as const,
      })),
      scores: saved.seats.map(() => 0),
      roundWinner: 'draw',
      result: null,
    }));
    const host = lightCyclesObserver(s);
    await pollUntil(
      s,
      async () => {
        const board = await lightCyclesBoardShown(s, host);
        return board.round === round && board.phase === 'round-over'
          ? true
          : null;
      },
      { maxMs: SHOWN_MS, stepMs: 10, description: 'the round result' }
    );
  },
});
