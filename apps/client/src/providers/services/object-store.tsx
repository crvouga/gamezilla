import { ObjectStoreImplExpoFileSystem } from '@pkgs/object-store/impl-expo-file-system';
import { ObjectStoreProvider } from '@pkgs/object-store/react-context';
import { useMemo, type ReactNode } from 'react';

// eslint-disable-next-line lingui/no-unlocalized-strings -- Internal directory name, not user-facing.
const BASE_DIR = 'object-store';

export function AppObjectStore({
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
