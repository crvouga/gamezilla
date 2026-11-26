import {
  type GameLesson,
  practiceBoard,
} from '@libs/game-menu-client-ts/game-lesson';
import {
  type LightCyclesRiderCount,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { parseLightCyclesInput } from '@libs/light-cycles-shared-ts/light-cycles-input';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { t } from '@lingui/core/macro';
import { LightCyclesBoard } from './light-cycles-board';

export function lightCyclesLesson(count: LightCyclesRiderCount): GameLesson {
  const config = lightCyclesConfig();
  const step = createLightCyclesStep(config);
  const codec = lightCyclesPositionCodec(count);
  const Board = practiceBoard(LightCyclesBoard, {
    simulationInput: (input) => parseLightCyclesInput(input)?.heading ?? null,
  });
  const initial = () =>
    codec.encode({ ...lightCyclesStart(count, 3), phase: 'running' });
  function turn(position: string, heading: 'up' | 'right') {
    let state = codec.decode(position);
    if (!state) throw new Error('Invalid practice arena');
    const input = {
      playerId: 'white',
      tick: 1,
      sequence: 1,
      value: { round: state.round, heading },
    };
    for (let tick = 1; tick <= config.movementTicks; tick++) {
      const deltaMs = 1000 / config.tickRate;
      state = step(state, tick === 1 ? [input] : [], {
        tick,
        deltaMs,
        elapsedMs: tick * deltaMs,
        random: () => 0,
      });
    }
    return codec.encode(state);
  }
  return [
    {
      Board,
      initial,
      play: (position, action) =>
        action === 'up' ? turn(position, 'up') : null,
      prompt: () =>
        t`Comet is riding right. Turn up with the direction pad or the Up arrow while the arena has focus.`,
      success: () =>
        t`Comet turned and left a solid trail behind. Every rider must avoid it.`,
    },
    {
      Board,
      initial: () => turn(initial(), 'up'),
      play: (position, action) =>
        action === 'right' ? turn(position, 'right') : null,
      prompt: () =>
        t`You cannot reverse into your own trail. Turn right into open ground.`,
      success: () => t`You stayed clear. The last rider moving wins the round.`,
    },
  ];
}
