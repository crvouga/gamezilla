import type { PongInput } from '@libs/pong-shared-ts/pong-state';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

/** Story driver input, refreshed on simulation ticks like a connected replica. */
export function createPongLiveInputs() {
  const held = new Map<GameSide, PongInput>();
  return {
    set: (side: GameSide, value: PongInput) => held.set(side, value),
    release: () => {
      for (const side of held.keys())
        held.set(side, { kind: 'direction', direction: 0 });
    },
    sample: (tick: number) =>
      [...held].map(([side, value], index) => ({
        tick,
        sequence: tick * 4 + index,
        playerId: side === 'white' ? 'left' : 'right',
        value,
      })),
  };
}
