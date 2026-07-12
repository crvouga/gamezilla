import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { ObjectStore, StoredObject } from './interface';
import { ObjectStoreWithPrefix } from './impl-with-prefix';

/**
 * Local-first {@link ObjectStore} for the Expo client. On native (iOS / Android)
 * bytes are stored as files under `Paths.document/<baseDir>/<key><ext>` with a
 * sibling `<key>.meta` JSON sidecar holding the `contentType` (the new
 * `expo-file-system` `File` API does not persist mime type for arbitrary bytes).
 * `<ext>` is derived from `contentType` via {@link extensionForContentType} so
 * iOS AVFoundation can decode cached audio (it MIME-sniffs by extension).
 * On web `expo-file-system` is a no-op (the package warns + returns empty
 * stubs), so this impl falls back to the Origin-Private File System (OPFS)
 * exposed via `navigator.storage.getDirectory()` — same persistence semantics.
 *
 * `getUri` returns:
 *   - native: the underlying `file://` URI from `expo-file-system`. Playable
 *     directly by `expo-audio`'s `useAudioPlayer({ uri })`.
 *   - web: a `blob:` URL freshly minted from the cached bytes
 *     (`URL.createObjectURL(new Blob(...))`). The TTS hook reuses the same URL
 *     for the lifetime of an utterance, so we accept the small cost of not
 *     revoking it (the browser cleans up at navigation).
 *
 * Keys must match `KEY_PATTERN` — the SHA-256 hex hash from
 * {@link ../tts/shared/tts-cache-key.ts ttsCacheKey} already conforms.
 */
const KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
const META_SUFFIX = '.meta';
const BIN_SUFFIX = '.bin';

/**
 * Map a stored object's `contentType` to a file extension iOS AVFoundation
 * recognises. iOS detects audio MIME type from the file extension alone —
 * blobs saved as `.bin` never finish loading and `useAudioPlayer.status.isLoaded`
 * stays false indefinitely, surfacing as "speaking avatar loading forever".
 * Web doesn't need this: `getUriWeb` returns a `blob:` URL whose MIME type
 * is encoded in the `Blob` object, not the file extension.
 */
function extensionForContentType(contentType: string): string {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  switch (normalized) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return '.mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return '.wav';
    case 'audio/aac':
    case 'audio/mp4':
      return '.aac';
    case 'audio/ogg':
      return '.ogg';
    default:
      return BIN_SUFFIX;
  }
}

export type ObjectStoreImplExpoFileSystemOptions = {
  /**
   * Sub-directory under `Paths.document` (native) or the OPFS root (web).
   * The directory is created lazily on first write. Use a fixed string per
   * cache namespace (e.g. `'object-store'`) so the same store is reopened
   * across app launches.
   */
  readonly baseDir: string;
};

interface OpfsFileHandle {
  createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
  }>;
  getFile(): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    type: string;
    size: number;
  }>;
}

interface OpfsDirHandle {
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<OpfsFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<OpfsDirHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

interface OpfsStorageManager {
  getDirectory(): Promise<OpfsDirHandle>;
}

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(
      `ObjectStoreImplExpoFileSystem: key must match ${KEY_PATTERN.source}, got: ${key}`
    );
  }
}

export class ObjectStoreImplExpoFileSystem implements ObjectStore {
  private readonly baseDir: string;
  private nativeDirReady = false;
  private opfsDirPromise: Promise<OpfsDirHandle> | null = null;

  constructor(options: ObjectStoreImplExpoFileSystemOptions) {
    if (options.baseDir.length === 0) {
      throw new Error(
        'ObjectStoreImplExpoFileSystem: baseDir must be non-empty'
      );
    }
    this.baseDir = options.baseDir;
  }

  private isWeb(): boolean {
    return Platform.OS === 'web';
  }

  private nativeDir(): Directory {
    return new Directory(Paths.document, this.baseDir);
  }

  private ensureNativeDir(): void {
    if (this.nativeDirReady) return;
    const dir = this.nativeDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    this.nativeDirReady = true;
  }

  private opfsRoot(): OpfsStorageManager {
    const root = (
      globalThis as unknown as { navigator?: { storage?: OpfsStorageManager } }
    ).navigator?.storage;
    if (root === undefined || typeof root.getDirectory !== 'function') {
      throw new Error(
        'ObjectStoreImplExpoFileSystem: OPFS unavailable — navigator.storage.getDirectory() missing'
      );
    }
    return root;
  }

  private async ensureOpfsDir(): Promise<OpfsDirHandle> {
    if (this.opfsDirPromise === null) {
      this.opfsDirPromise = (async () => {
        const root = await this.opfsRoot().getDirectory();
        return root.getDirectoryHandle(this.baseDir, { create: true });
      })();
    }
    return this.opfsDirPromise;
  }

  async get(key: string): Promise<StoredObject | null> {
    assertKey(key);
    if (this.isWeb()) return this.getWeb(key);
    return this.getNative(key);
  }

  private getNative(key: string): StoredObject | null {
    const meta = this.readNativeMeta(key);
    if (meta === null) return null;
    const ext = extensionForContentType(meta.contentType);
    const file = new File(this.nativeDir(), `${key}${ext}`);
    if (!file.exists) return null;
    const bytes = file.bytesSync();
    const stream = bytesStream(bytes);
    return {
      body: stream,
      contentType: meta.contentType,
      size: bytes.byteLength,
    };
  }

  private async getWeb(key: string): Promise<StoredObject | null> {
    const dir = await this.ensureOpfsDir();
    const handle = await tryGetOpfsFile(dir, `${key}${BIN_SUFFIX}`);
    if (handle === null) return null;
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const meta = await this.readWebMeta(dir, key);
    return {
      body: bytesStream(bytes),
      contentType: meta.contentType,
      size: bytes.byteLength,
    };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    assertKey(key);
    if (this.isWeb()) {
      await this.putWeb(key, bytes, contentType);
      return;
    }
    this.putNative(key, bytes, contentType);
  }

  private putNative(key: string, bytes: Uint8Array, contentType: string): void {
    this.ensureNativeDir();
    const dir = this.nativeDir();
    const ext = extensionForContentType(contentType);
    const bodyFile = new File(dir, `${key}${ext}`);
    if (bodyFile.exists) bodyFile.delete();
    bodyFile.create();
    bodyFile.write(bytes);
    const metaFile = new File(dir, `${key}${META_SUFFIX}`);
    if (metaFile.exists) metaFile.delete();
    metaFile.create();
    metaFile.write(JSON.stringify({ contentType }));
  }

  private async putWeb(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const dir = await this.ensureOpfsDir();
    await writeOpfs(dir, `${key}${BIN_SUFFIX}`, bytes);
    const metaBytes = new TextEncoder().encode(JSON.stringify({ contentType }));
    await writeOpfs(dir, `${key}${META_SUFFIX}`, metaBytes);
  }

  async head(key: string): Promise<boolean> {
    assertKey(key);
    if (this.isWeb()) {
      const dir = await this.ensureOpfsDir();
      return (await tryGetOpfsFile(dir, `${key}${BIN_SUFFIX}`)) !== null;
    }
    const meta = this.readNativeMeta(key);
    if (meta === null) return false;
    const ext = extensionForContentType(meta.contentType);
    return new File(this.nativeDir(), `${key}${ext}`).exists;
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    if (this.isWeb()) {
      const dir = await this.ensureOpfsDir();
      await removeOpfsIfExists(dir, `${key}${BIN_SUFFIX}`);
      await removeOpfsIfExists(dir, `${key}${META_SUFFIX}`);
      return;
    }
    const dir = this.nativeDir();
    const meta = this.readNativeMeta(key);
    if (meta !== null) {
      const ext = extensionForContentType(meta.contentType);
      const body = new File(dir, `${key}${ext}`);
      if (body.exists) body.delete();
    }
    const metaFile = new File(dir, `${key}${META_SUFFIX}`);
    if (metaFile.exists) metaFile.delete();
  }

  async getUri(key: string): Promise<string | null> {
    assertKey(key);
    if (this.isWeb()) return this.getUriWeb(key);
    return this.getUriNative(key);
  }

  private getUriNative(key: string): string | null {
    const meta = this.readNativeMeta(key);
    if (meta === null) return null;
    const ext = extensionForContentType(meta.contentType);
    const file = new File(this.nativeDir(), `${key}${ext}`);
    if (!file.exists) return null;
    return file.uri;
  }

  private async getUriWeb(key: string): Promise<string | null> {
    const stored = await this.getWeb(key);
    if (stored === null) return null;
    const bytes = await readAllBytes(stored.body);
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function')
      return null;
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    return URL.createObjectURL(new Blob([ab], { type: stored.contentType }));
  }

  private readNativeMeta(key: string): { contentType: string } | null {
    const metaFile = new File(this.nativeDir(), `${key}${META_SUFFIX}`);
    if (!metaFile.exists) return null;
    try {
      const parsed = JSON.parse(metaFile.textSync()) as {
        contentType?: unknown;
      };
      const ct =
        typeof parsed.contentType === 'string' && parsed.contentType.length > 0
          ? parsed.contentType
          : 'application/octet-stream';
      return { contentType: ct };
    } catch {
      return { contentType: 'application/octet-stream' };
    }
  }

  private async readWebMeta(
    dir: OpfsDirHandle,
    key: string
  ): Promise<{ contentType: string }> {
    const handle = await tryGetOpfsFile(dir, `${key}${META_SUFFIX}`);
    if (handle === null) return { contentType: 'application/octet-stream' };
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buf));
    try {
      const parsed = JSON.parse(text) as { contentType?: unknown };
      const ct =
        typeof parsed.contentType === 'string' && parsed.contentType.length > 0
          ? parsed.contentType
          : 'application/octet-stream';
      return { contentType: ct };
    } catch {
      return { contentType: 'application/octet-stream' };
    }
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const copy = new Uint8Array(bytes);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
}

async function readAllBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function tryGetOpfsFile(
  dir: OpfsDirHandle,
  name: string
): Promise<OpfsFileHandle | null> {
  try {
    return await dir.getFileHandle(name, { create: false });
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return null;
    throw err;
  }
}

async function writeOpfs(
  dir: OpfsDirHandle,
  name: string,
  bytes: Uint8Array
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes);
  } finally {
    await writable.close();
  }
}

async function removeOpfsIfExists(
  dir: OpfsDirHandle,
  name: string
): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return;
    throw err;
  }
}
