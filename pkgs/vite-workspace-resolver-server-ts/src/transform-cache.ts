import { createHash } from 'node:crypto';
import { relative } from 'node:path';
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
      const kept = options.store.read(key);
      if (kept !== null) return JSON.parse(kept) as Transformed;
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
