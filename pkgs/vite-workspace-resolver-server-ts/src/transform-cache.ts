import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import type { Plugin } from 'vite';

/**
 * Where transformed modules are kept between builds: one text per key.
 * `directoryTransformStore` keeps them in a directory.
 */
export type TransformStore = {
  read(key: string): string | null;
  write(key: string, value: string): void;
  keys(): readonly string[];
  remove(key: string): void;
};

export type TransformCacheOptions = {
  readonly store: TransformStore;
  /**
   * Everything but a module's own text and name that decides its output:
   * the plugin's versions and options, the build's mode. A different salt
   * shares nothing with another.
   */
  readonly salt: string;
  /** The modules the plugin transforms; any other is handed straight to it. */
  readonly include: RegExp;
  /**
   * The repository's root: a module is known by its path under it, so what
   * one checkout remembers another can use.
   */
  readonly root: string;
};

type Transformed = { readonly code: string } | null;

function keyOf(salt: string, name: string, source: string): string {
  return createHash('sha256')
    .update(salt)
    .update('\0')
    .update(name)
    .update('\0')
    .update(source)
    .digest('hex');
}

/**
 * What the store holds for a module; `undefined` when it holds nothing, or
 * something that is not a whole answer (a store another process is still
 * filling), which is transformed again like any module never seen.
 */
function keptOf(text: string | null): Transformed | undefined {
  if (text === null) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    if (value === null) return null;
    const code = (value as { code?: unknown }).code;
    return typeof code === 'string' ? { code } : undefined;
  } catch {
    return undefined;
  }
}

function transformedOf(result: unknown): Transformed {
  if (typeof result === 'string') return { code: result };
  if (result === null || typeof result !== 'object') return null;
  const code = (result as { code?: unknown }).code;
  return typeof code === 'string' ? { code } : null;
}

/**
 * `plugin`, remembering what it made of each module. A build's time in a
 * Babel plugin is spent on modules that have not changed since the build
 * before; a module whose text, name and salt are what they were is answered
 * from the store, and only the rest are transformed. The plugin must be a
 * pure function of those three for the modules `include` names. Source maps
 * are not kept: this is for builds that emit none.
 *
 * A build that ends well forgets every module it did not ask for, so the
 * store holds one build's modules however many builds it lives through.
 */
export function rememberTransforms(
  plugin: Plugin,
  options: TransformCacheOptions
): Plugin {
  const { transform, buildEnd } = plugin;
  if (typeof transform !== 'function')
    throw new Error(`${plugin.name} has no transform function to remember`);
  const asked = new Set<string>();
  return {
    ...plugin,
    async transform(source, id, transformOptions) {
      const run = () => transform.call(this, source, id, transformOptions);
      const file = id.replace(/\?.*$/, '');
      if (!options.include.test(file)) return await run();
      const name = slashPath(relative(options.root, file));
      const key = keyOf(options.salt, name, source);
      asked.add(key);
      const kept = keptOf(options.store.read(key));
      if (kept !== undefined) return kept;
      const made = transformedOf(await run());
      options.store.write(
        key,
        JSON.stringify(made === null ? null : { code: made.code, map: null })
      );
      return made === null ? null : { code: made.code, map: null };
    },
    async buildEnd(error) {
      if (error === undefined)
        for (const key of options.store.keys())
          if (!asked.has(key)) options.store.remove(key);
      // The next build in this process asks for its own modules.
      asked.clear();
      if (typeof buildEnd === 'function') await buildEnd.call(this, error);
    },
  };
}

const KEY = /^[0-9a-f]{64}$/;

/** Everything a store remembers, as one file to carry to another machine. */
export function packTransforms(store: TransformStore): Uint8Array<ArrayBuffer> {
  const all: Record<string, string> = {};
  for (const key of store.keys().toSorted()) {
    const value = KEY.test(key) ? store.read(key) : null;
    if (value !== null) all[key] = value;
  }
  return new Uint8Array(gzipSync(JSON.stringify(all)));
}

/**
 * Put what `packTransforms` packed into `store`; how many modules that was.
 * Anything that is not such a file adds nothing: a key is only ever the
 * digest it was stored under, so no file names a place outside the store.
 */
export function unpackTransforms(
  store: TransformStore,
  packed: Uint8Array
): number {
  let all: unknown;
  try {
    all = JSON.parse(gunzipSync(packed).toString('utf8'));
  } catch {
    return 0;
  }
  if (all === null || typeof all !== 'object' || Array.isArray(all)) return 0;
  let count = 0;
  for (const [key, value] of Object.entries(all)) {
    if (!KEY.test(key) || typeof value !== 'string') continue;
    store.write(key, value);
    count += 1;
  }
  return count;
}
