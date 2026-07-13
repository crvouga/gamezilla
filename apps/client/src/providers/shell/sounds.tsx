import { SoundEngineProvider, SoundsPreferenceProvider } from '@pkgs/sounds';
import type { ReactNode } from 'react';

/** Global UI sound preferences + playback engine (requires KvProvider). */
export function AppSoundsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <SoundsPreferenceProvider>
      <SoundEngineProvider>{children}</SoundEngineProvider>
    </SoundsPreferenceProvider>
  );
}
