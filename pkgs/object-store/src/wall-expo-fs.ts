// @io-wall-ok
/**
 * Wall Expo / OPFS filesystem adapter — the only product module allowed to
 * import `expo-file-system` for object-store. Pass into
 * {@link ./impl-expo-file-system.ts ObjectStoreImplExpoFileSystem} or
 * {@link ./impl-client-fs.ts ObjectStoreImplClientFs}.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
  ExpoFs,
  ExpoFsDirectory,
  ExpoFsDirEntry,
  ExpoFsFile,
  ExpoFsOpfsDirHandle,
} from './expo-fs';

function mapListEntry(entry: Directory | File): ExpoFsDirEntry {
  const name = entry.name;
  if (typeof name !== 'string' || name.length === 0) {
    return { name: '', kind: 'file' };
  }
  return {
    name,
    kind: entry instanceof Directory ? 'directory' : 'file',
  };
}

export function wallExpoFs(): ExpoFs {
  return {
    // Lazy: `Paths.document` constructs a Directory that calls `validatePath`,
    // which the web ExpoFileSystem stub does not implement. Native object-store
    // paths access this only when Platform.OS !== 'web'.
    paths: {
      get document() {
        return Paths.document;
      },
    },
    platformOs: Platform.OS,
    createDirectory(root, ...segments) {
      const dir = new Directory(root as never, ...segments);
      const originalList = dir.list.bind(dir);
      Object.defineProperty(dir, 'list', {
        configurable: true,
        value: (): readonly ExpoFsDirEntry[] =>
          originalList().map(mapListEntry),
      });
      return dir as unknown as ExpoFsDirectory;
    },
    createFile(dir, name) {
      return new File(dir as never, name) as unknown as ExpoFsFile;
    },
    async getOpfsRoot() {
      const root = (
        globalThis as unknown as {
          navigator?: {
            storage?: { getDirectory(): Promise<ExpoFsOpfsDirHandle> };
          };
        }
      ).navigator?.storage;
      if (root === undefined || typeof root.getDirectory !== 'function') {
        throw new Error(
          'wallExpoFs: OPFS unavailable — navigator.storage.getDirectory() missing'
        );
      }
      return root.getDirectory();
    },
  };
}
