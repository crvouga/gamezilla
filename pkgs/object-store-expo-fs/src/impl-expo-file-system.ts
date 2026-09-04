import { ObjectStoreWithPrefix } from '@pkgs/object-store/impl-with-prefix';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';
import type { ExpoFs, ExpoFsDirectory, ExpoFsOpfsDirHandle } from './expo-fs';

/**
 * Local-first {@link ObjectStore} for the Expo client. On native (iOS / Android)
 * bytes are stored as files under `document/<baseDir>/<key><ext>` with a
 * sibling `<key>.meta` JSON sidecar holding the `contentType`. On web this
 * falls back to OPFS via the injected {@link ExpoFs}.
 *
 * Wall `expo-file-system` is injected via {@link ObjectStoreImplExpoFileSystemOptions.expoFs}.
 *
 * Keys must match `KEY_PATTERN` — the SHA-256 hex hash from TTS cache keys
 * already conforms.
 */
const KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
const META_SUFFIX = '.meta';
const BIN_SUFFIX = '.bin';

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
   * Sub-directory under document (native) or the OPFS root (web).
   * The directory is created lazily on first write.
   */
  readonly baseDir: string;
  /** Injected Expo / OPFS surface — composition roots pass {@link ./wall-expo-fs.ts wallExpoFs()}. */
  readonly expoFs: ExpoFs;
};

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(
      `ObjectStoreImplExpoFileSystem: key must match ${KEY_PATTERN.source}, got: ${key}`
    );
  }
}

export class ObjectStoreImplExpoFileSystem implements ObjectStore {
  private readonly baseDir: string;
  private readonly expoFs: ExpoFs;
  private nativeDirReady = false;
  private opfsDirPromise: Promise<ExpoFsOpfsDirHandle> | null = null;

  constructor(options: ObjectStoreImplExpoFileSystemOptions) {
    if (options.baseDir.length === 0) {
      throw new Error(
        'ObjectStoreImplExpoFileSystem: baseDir must be non-empty'
      );
    }
    this.baseDir = options.baseDir;
    this.expoFs = options.expoFs;
  }

  private isWeb(): boolean {
    return this.expoFs.platformOs === 'web';
  }

  private nativeDir(): ExpoFsDirectory {
    return this.expoFs.createDirectory(
      this.expoFs.paths.document,
      this.baseDir
    );
  }

  private ensureNativeDir(): void {
    if (this.nativeDirReady) return;
    const dir = this.nativeDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    this.nativeDirReady = true;
  }

  private async ensureOpfsDir(): Promise<ExpoFsOpfsDirHandle> {
    if (this.opfsDirPromise === null) {
      this.opfsDirPromise = (async () => {
        const root = await this.expoFs.getOpfsRoot();
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
    const file = this.expoFs.createFile(this.nativeDir(), `${key}${ext}`);
    if (!file.exists) return null;
    const bytes = file.bytesSync();
    return {
      body: bytesStream(bytes),
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
    const bodyFile = this.expoFs.createFile(dir, `${key}${ext}`);
    if (bodyFile.exists) bodyFile.delete();
    bodyFile.create();
    bodyFile.write(bytes);
    const metaFile = this.expoFs.createFile(dir, `${key}${META_SUFFIX}`);
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
    return this.expoFs.createFile(this.nativeDir(), `${key}${ext}`).exists;
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
      const body = this.expoFs.createFile(dir, `${key}${ext}`);
      if (body.exists) body.delete();
    }
    const metaFile = this.expoFs.createFile(dir, `${key}${META_SUFFIX}`);
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
    const file = this.expoFs.createFile(this.nativeDir(), `${key}${ext}`);
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

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const keys = this.isWeb()
      ? await this.listKeysWeb()
      : this.listKeysNative();
    const filtered =
      prefix.length === 0 ? keys : keys.filter((k) => k.startsWith(prefix));
    return filtered.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  private listKeysNative(): string[] {
    const dir = this.nativeDir();
    if (!dir.exists || typeof dir.list !== 'function') return [];
    const keys: string[] = [];
    for (const entry of dir.list()) {
      if (entry.kind === 'directory') continue;
      const name = entry.name;
      if (name.length === 0 || name.endsWith(META_SUFFIX)) continue;
      const key = name.replace(/\.[^.]+$/, '');
      if (KEY_PATTERN.test(key)) keys.push(key);
    }
    return keys;
  }

  private async listKeysWeb(): Promise<string[]> {
    const dir = await this.ensureOpfsDir();
    const keys: string[] = [];
    for await (const name of dir.keys()) {
      if (!name.endsWith(BIN_SUFFIX)) continue;
      const key = name.slice(0, -BIN_SUFFIX.length);
      if (KEY_PATTERN.test(key)) keys.push(key);
    }
    return keys;
  }

  private readNativeMeta(key: string): { contentType: string } | null {
    const metaFile = this.expoFs.createFile(
      this.nativeDir(),
      `${key}${META_SUFFIX}`
    );
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
    dir: ExpoFsOpfsDirHandle,
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
  dir: ExpoFsOpfsDirHandle,
  name: string
): Promise<Awaited<ReturnType<ExpoFsOpfsDirHandle['getFileHandle']>> | null> {
  try {
    return await dir.getFileHandle(name, { create: false });
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return null;
    throw err;
  }
}

async function writeOpfs(
  dir: ExpoFsOpfsDirHandle,
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
  dir: ExpoFsOpfsDirHandle,
  name: string
): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return;
    throw err;
  }
}
