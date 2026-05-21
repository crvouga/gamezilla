import { ObjectStoreImplExpoFileSystem } from '@pkgs/object-store/impl-expo-file-system';
import { ObjectStoreProvider } from '@pkgs/object-store/react-context';
import { useMemo, type ReactNode } from 'react';

/**
 * App-wide local-first binary blob cache. Backs `TtsProvider`'s audio cache
 * (`pkgs/tts/src/client/tts-context.tsx` reads it via `useObjectStore`)
 * and any future feature that wants a content-addressed bytes store
 * (exported files, derived avatars, etc.).
 *
 * Native (iOS / Android) persists under `Paths.document/object-store/`; web
 * uses OPFS via `navigator.storage.getDirectory()`. The directory survives
 * app restarts but is wiped by "Clear app data" / browser site-data clear.
 */
// eslint-disable-next-line lingui/no-unlocalized-strings -- Internal directory name, not user-facing.
const BASE_DIR = 'object-store';

export function ObjectStoreProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const store = useMemo(
    () => new ObjectStoreImplExpoFileSystem({ baseDir: BASE_DIR }),
    []
  );
  return <ObjectStoreProvider value={store}>{children}</ObjectStoreProvider>;
}
