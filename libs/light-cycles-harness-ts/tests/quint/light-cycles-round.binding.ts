import {
  endCountdown,
  endRoundResult,
  lightCyclesModelArena,
  passSeconds,
  sendLateTurn,
  steerModelRider,
  takeRidersStep,
} from '@libs/light-cycles-harness-ts/light-cycles-model-actions';
import type {
  ModelGame,
  ModelPerson,
  ModelRider,
} from '@libs/light-cycles-harness-ts/light-cycles-model-arena';
import { readModelArena } from '@libs/light-cycles-harness-ts/light-cycles-model-observation';
import type { LightCyclesHeading } from '@libs/light-cycles-shared-ts/light-cycles-heading';
import { bindQuintModel, type Picks } from '@pkgs/quint-shared-ts/registry';
import crashedRiderTurn from './fixtures/light-cycles-crashed-rider-takes-its-turn.itf.json';
import { type LightCyclesTraceWorld, traceArena } from './world';

const turn = (picks: Picks) =>
  [
    String(picks['person']) as ModelPerson,
    String(picks['rider']) as ModelRider,
    String(picks['direction']) as LightCyclesHeading,
  ] as const;

bindQuintModel<LightCyclesTraceWorld>({
  model: 'light-cycles-round',
  traces: 16,
  maxSteps: 16,
  regressions: [
    {
      // regression: light-cycles-crashed-rider-takes-its-turn
      id: 'light-cycles-crashed-rider-takes-its-turn',
      title: 'Comet turning up into the edge crashes still heading right',
      seed: '0x67932',
      itf: crashedRiderTurn,
    },
  ],
  actions: {
    init: async (w, picks) => {
      w.arena = await lightCyclesModelArena.run({
        seed: w.ctx.seed,
        args: {
          game: String(picks['m']) as ModelGame,
          target: Number(picks['target']),
        },
      });
    },
    steer: (w, picks) => traceArena(w).apply(steerModelRider, ...turn(picks)),
    lateTurn: (w, picks) => traceArena(w).apply(sendLateTurn, ...turn(picks)),
    countdownEnds: (w) => traceArena(w).apply(endCountdown),
    ridersStep: (w) => traceArena(w).apply(takeRidersStep),
    resultEnds: (w) => traceArena(w).apply(endRoundResult),
    secondsPass: (w) => traceArena(w).apply(passSeconds, 3),
  },
  observe: (w) => traceArena(w).read(readModelArena),
});
