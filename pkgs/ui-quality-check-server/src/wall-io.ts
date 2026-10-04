// @io-wall-ok — public Node/Bun composition root; core code receives unpacked ports.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { whichPath } from '@pkgs/os-server/command';
import { startProcess } from '@pkgs/os-server/streaming-process';
import ffmpeg from 'ffmpeg-static';
import manifest from '../assets/manifest.json';
import type { Files } from './files';

function streamStore(directory: string): ObjectStore {
  const root = resolve(directory);
  const base = createNodeFsObjectStore({
    rootDir: root,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const get: ObjectStore['get'] = async (key) => {
    const path = resolve(root, key);
    const rel = relative(root, path);
    if (rel.startsWith('..') || resolve(root, rel) !== path || path === root)
      throw new Error(`Invalid object key: ${key}`);
    try {
      const info = await stat(path);
      if (!info.isFile()) throw new Error(`Expected a file: ${path}`);
      return {
        body: Readable.toWeb(
          createReadStream(path)
        ) as unknown as ReadableStream<Uint8Array>,
        contentType: 'application/octet-stream',
        size: info.size,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  };
  return {
    get,
    put: (key, bytes, type) => base.put(key, bytes, type),
    head: (key) => base.head(key),
    delete: (key) => base.delete(key),
    deleteMany: (keys) => base.deleteMany(keys),
    getUri: (key) => base.getUri(key),
    listKeys: (prefix) => base.listKeys(prefix),
    withPrefix: (prefix) => base.withPrefix(prefix),
  };
}

export const localFiles: Files = {
  store: streamStore,
  async list(input) {
    const path = resolve(input);
    const info = await stat(path);
    if (info.isFile()) return [path];
    if (!info.isDirectory())
      throw new Error(`Expected a file or directory: ${input}`);
    return (await streamStore(path).listKeys()).map((key) => join(path, key));
  },
};

export const localClock = wallClock;
export const localHttp = createGlobalHttpClient();
export const localProcess = startProcess;
export const assetDirectory = fileURLToPath(
  new URL('../assets/', import.meta.url)
);
export const defaultModelDirectory = join(
  homedir(),
  '.cache',
  'ui-quality-check',
  manifest.modelVersion
);

export function decoderPath(override?: string): string {
  const candidate = override ?? ffmpeg ?? whichPath('ffmpeg');
  if (!candidate)
    throw new Error(
      'FFmpeg is unavailable. Reinstall ffmpeg-static with install scripts enabled, or supply ffmpegPath.'
    );
  return candidate;
}

export function runtimeMetrics() {
  return {
    cpu: process.cpuUsage(),
    memory: process.memoryUsage(),
    resource: process.resourceUsage(),
  };
}
