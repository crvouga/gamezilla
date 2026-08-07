import { ObjectStoreImplExpoFileSystem } from '@pkgs/object-store/impl-expo-file-system';
import { ObjectStoreProvider } from '@pkgs/object-store/react-context';
import { type ReactNode, useMemo } from 'react';

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
