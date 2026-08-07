import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import {
  createSoundEngine,
  type PlaySoundOptions,
  type SoundEngine,
} from './sound-engine';
import { type SoundId, Sounds } from './sound-id';
import { useSoundsPreference } from './use-sounds-preference';

const SoundEngineContext = createContext<SoundEngine | null>(null);

export type SoundEngineProviderProps = {
  readonly children: ReactNode;
};

export function SoundEngineProvider({
  children,
}: SoundEngineProviderProps): ReactNode {
  const { muted, masterVolume } = useSoundsPreference();
  const engine = useMemo(
    () => createSoundEngine({ muted, masterVolume }),
    [masterVolume, muted]
  );

  useEffect(() => () => engine.dispose(), [engine]);

  return (
    <SoundEngineContext.Provider value={engine}>
      {children}
    </SoundEngineContext.Provider>
  );
}

function useSoundEngineContext(): SoundEngine {
  const engine = useContext(SoundEngineContext);
  if (engine === null) {
    throw new Error('useSoundEngine must be used within SoundEngineProvider');
  }
  return engine;
}

export function useSoundEngine(): {
  readonly play: (id: SoundId, options?: PlaySoundOptions) => void;
  readonly Sounds: typeof Sounds;
} {
  const engine = useSoundEngineContext();
  return useMemo(
    () => ({
      play: (id: SoundId, options?: PlaySoundOptions) => {
        engine.play(id, options);
      },
      Sounds,
    }),
    [engine]
  );
}

export function useOptionalSoundEngine(): SoundEngine | null {
  return useContext(SoundEngineContext);
}

export function useSound(id: SoundId): {
  readonly play: (options?: PlaySoundOptions) => void;
} {
  const { play } = useSoundEngine();
  return useMemo(
    () => ({
      play: (options?: PlaySoundOptions) => {
        play(id, options);
      },
    }),
    [id, play]
  );
}
