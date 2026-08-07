import { type SoundId, Sounds } from '@pkgs/sounds';
import { useOptionalSoundEngine } from '@pkgs/sounds/use-sound-engine';
import { useCallback } from 'react';

import type { MutationPhase } from '../components/mutation-modal/use-mutation-lifecycle';

export type MutationSoundIds = {
  readonly success?: SoundId;
  readonly error?: SoundId;
};

export function useMutationPhaseSoundHandler(
  sounds?: MutationSoundIds
): (phase: MutationPhase) => void {
  const engine = useOptionalSoundEngine();
  return useCallback(
    (phase: MutationPhase) => {
      if (engine === null) return;
      if (phase === 'success') {
        engine.play(sounds?.success ?? Sounds.feedback.success);
      }
      if (phase === 'error') {
        engine.play(sounds?.error ?? Sounds.feedback.error);
      }
    },
    [engine, sounds?.error, sounds?.success]
  );
}
