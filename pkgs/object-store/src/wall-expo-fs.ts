// @io-wall-ok
/**
 * Wall Expo / OPFS filesystem adapter — the only product module allowed to
 * import `expo-file-system` for object-store. Pass into
 * {@link ./impl-expo-file-system.ts ObjectStoreImplExpoFileSystem}.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
  ExpoFs,
  ExpoFsDirectory,
  ExpoFsFile,
  ExpoFsOpfsDirHandle,
} from './expo-fs';

export function wallExpoFs(): ExpoFs {
  return {
    paths: { document: Paths.document },
    platformOs: Platform.OS,
    createDirectory(root, baseDir) {
      return new Directory(
        root as never,
        baseDir
      ) as unknown as ExpoFsDirectory;
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
