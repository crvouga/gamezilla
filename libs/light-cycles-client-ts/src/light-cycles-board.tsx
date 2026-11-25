import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo } from 'solid-js';
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
  createEffect(
    () => [state(), enabled(), engine?.()] as const,
    ([current, audible, sounds]) => {
      if (current === null) return;
      const now = {
        crashes: current.crashes.length,
        round: current.round,
        phase: current.phase,
      };
      if (previous !== null && audible && previous.round === now.round) {
        if (now.phase === 'round-over' && previous.phase !== 'round-over')
          sounds?.play('gameplay.turnEnd');
        else if (now.crashes > previous.crashes)
          sounds?.play('gameplay.capture');
        else if (now.phase === 'running' && previous.phase === 'countdown')
          sounds?.play('gameplay.turnStart');
      }
      previous = now;
    }
  );
}
