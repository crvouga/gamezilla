import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { createEffect, createMemo, type JSX } from 'solid-js';
import {
  decodeLightCycles,
  LightCyclesBoardView,
} from './light-cycles-board-view';

/** The arena with its sounds: a crash, a round's start and its end. */
export function LightCyclesBoard(props: GameBoardProps): JSX.Element {
  const state = createMemo(() => decodeLightCycles(props.position));
  useLightCyclesSounds(state, () => props.sound);
  return <LightCyclesBoardView {...props} />;
}

function useLightCyclesSounds(
  state: () => LightCyclesState | null,
  enabled: () => boolean
): void {
  const engine = useOptionalSoundEngine();
  let previous: { crashes: number; round: number; phase: string } | null = null;
  createEffect(() => {
    const current = state();
    if (current === null) return;
    const now = {
      crashes: current.crashes.length,
      round: current.round,
      phase: current.phase,
    };
    if (previous !== null && enabled() && previous.round === now.round) {
      if (now.phase === 'round-over' && previous.phase !== 'round-over')
        engine?.().play('gameplay.turnEnd');
      else if (now.crashes > previous.crashes)
        engine?.().play('gameplay.capture');
      else if (now.phase === 'running' && previous.phase === 'countdown')
        engine?.().play('gameplay.turnStart');
    }
    previous = now;
  });
}
