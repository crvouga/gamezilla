import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore, StoredObject } from './interface';
import { assertLogicalObjectKey } from './namespace-guard';

const META_SUFFIX = '.meta.json';

export type NodeFsObjectStoreOptions = {
  /** Absolute or relative directory root for all keys. */
  readonly rootDir: string;
};

type Meta = {
  readonly contentType: string;
};

/**
 * Node/Bun {@link ObjectStore} backed by the local filesystem.
 * Keys may include `/` (mapped to directories). Rejects `..` and absolute keys.
 */
export class ObjectStoreImplNodeFs implements ObjectStore {
  private readonly rootDir: string;

  constructor(options: NodeFsObjectStoreOptions) {
    if (options.rootDir.trim().length === 0) {
      throw new Error('ObjectStoreImplNodeFs: rootDir must be non-empty');
    }
    this.rootDir = resolve(options.rootDir);
  }

  private pathsFor(key: string): { dataPath: string; metaPath: string } {
    assertLogicalObjectKey(key);
    const dataPath = resolve(this.rootDir, ...key.split('/'));
    const rel = relative(this.rootDir, dataPath);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new Error(`ObjectStoreImplNodeFs: key escapes rootDir: ${key}`);
    }
    return { dataPath, metaPath: `${dataPath}${META_SUFFIX}` };
  }

  async get(key: string): Promise<StoredObject | null> {
    const { dataPath, metaPath } = this.pathsFor(key);
    try {
      const [bytes, metaRaw] = await Promise.all([
        readFile(dataPath),
        readFile(metaPath, 'utf8'),
      ]);
      const meta = JSON.parse(metaRaw) as Meta;
      const copy = new Uint8Array(bytes);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(copy);
          controller.close();
        },
      });
      return {
        body: stream,
        contentType: meta.contentType,
        size: copy.byteLength,
      };
    } catch {
      return null;
    }
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const { dataPath, metaPath } = this.pathsFor(key);
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, bytes);
    const meta: Meta = { contentType };
    await writeFile(metaPath, JSON.stringify(meta), 'utf8');
  }

  async head(key: string): Promise<boolean> {
    const { dataPath } = this.pathsFor(key);
    try {
      await readFile(dataPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const { dataPath, metaPath } = this.pathsFor(key);
    await rm(dataPath, { force: true });
    await rm(metaPath, { force: true });
  }

  async getUri(key: string): Promise<string | null> {
    if (!(await this.head(key))) return null;
    const { dataPath } = this.pathsFor(key);
    return pathToFileURL(dataPath).href;
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createNodeFsObjectStore(
  options: NodeFsObjectStoreOptions
): ObjectStore {
  return new ObjectStoreImplNodeFs(options);
}
