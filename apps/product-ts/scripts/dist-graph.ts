/**
 * Reads a built `dist/` (through an injected {@link ObjectStore}) into the
 * pure {@link OfflineShellInput} the `sw-policy.ts` analysis takes.
 */
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { OfflineShellInput } from './sw-policy';
import {
  ENTRY_HTML,
  HARNESS_BOOT_SOURCE,
  URL_LOADED_DIRS,
  VITE_MANIFEST,
} from './sw-policy';

export const SW_FILE = 'sw.js';

/** Placeholders like `.gitkeep`; Workbox's glob skips dotfiles too. */
function isDotfile(key: string): boolean {
  return key.split('/').some((segment) => segment.startsWith('.'));
}

async function requireUtf8(store: ObjectStore, key: string): Promise<string> {
  const text = await readUtf8(store, key);
  if (text === null) throw new Error(`dist/${key} is missing — build first`);
  return text;
}

/**
 * The harness boot's built chunk, from Vite's `.vite/manifest.json`. Empty
 * when the build split no such chunk off: everything is then wall-reachable.
 */
export function harnessBootChunks(manifestJson: string | null): string[] {
  if (manifestJson === null) return [];
  const manifest = JSON.parse(manifestJson) as Record<
    string,
    { readonly file?: string }
  >;
  const file = manifest[HARNESS_BOOT_SOURCE]?.file;
  return file === undefined ? [] : [file];
}

async function sizeOf(store: ObjectStore, key: string): Promise<number> {
  const object = await store.get(key);
  if (object === null) throw new Error(`dist/${key} vanished while reading`);
  await object.body.cancel();
  return object.size;
}

/** Everything the analysis needs except the SW (absent before Workbox runs). */
export async function readDistGraph(
  store: ObjectStore
): Promise<Omit<OfflineShellInput, 'swSource'>> {
  const keys = (await store.listKeys()).filter((key) => key !== SW_FILE);
  const files = await Promise.all(
    keys.map(async (path) => ({ path, bytes: await sizeOf(store, path) }))
  );
  const chunkKeys = keys.filter((key) => /\.m?js$/.test(key));
  const chunkSources = new Map(
    await Promise.all(
      chunkKeys.map(
        async (key) => [key, await requireUtf8(store, key)] as const
      )
    )
  );
  return {
    files,
    chunkSources,
    indexHtml: await requireUtf8(store, ENTRY_HTML),
    excludedRoots: harnessBootChunks(await readUtf8(store, VITE_MANIFEST)),
    extraRoots: keys.filter(
      (key) =>
        URL_LOADED_DIRS.some((dir) => key.startsWith(dir)) && !isDotfile(key)
    ),
  };
}

export async function readOfflineShellInput(
  store: ObjectStore
): Promise<OfflineShellInput> {
  const graph = await readDistGraph(store);
  return { ...graph, swSource: await requireUtf8(store, SW_FILE) };
}
