import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { Plugin } from 'vite';
import {
  rememberTransforms,
  type TransformStore,
} from '../src/transform-cache';
import { directoryTransformStore } from '../src/transform-cache-directory';

function memoryStore(): TransformStore & {
  readonly held: Map<string, string>;
} {
  const held = new Map<string, string>();
  return {
    held,
    read: (key) => held.get(key) ?? null,
    write: (key, value) => void held.set(key, value),
    keys: () => [...held.keys()],
    remove: (key) => void held.delete(key),
  };
}

/** A transform that says what it was given, and counts how often it ran. */
function compiler(label = 'compiled') {
  const ran: string[] = [];
  const plugin: Plugin = {
    name: 'compiler',
    transform(source, id) {
      ran.push(id);
      return id.endsWith('.skip.tsx')
        ? null
        : { code: `/* ${label} ${id} */ ${source}`, map: { mappings: 'AAAA' } };
    },
  };
  return { plugin, ran };
}

type Module = { readonly id: string; readonly source: string };

/** One build over `modules`: every transform, then a clean end. */
async function build(
  plugin: Plugin,
  modules: readonly Module[],
  error?: Error
): Promise<(string | null)[]> {
  const call = plugin.transform as unknown as (
    this: unknown,
    source: string,
    id: string
  ) => Promise<{ code: string } | null>;
  const out: (string | null)[] = [];
  for (const module of modules)
    out.push((await call.call({}, module.source, module.id))?.code ?? null);
  await (
    plugin.buildEnd as unknown as (
      this: unknown,
      error?: Error
    ) => Promise<void>
  ).call({}, error);
  return out;
}

const options = (store: TransformStore, salt = 'v1') => ({
  store,
  salt,
  include: /\.tsx$/,
  root: '/repo',
});

const moduleOf = fc.record({
  id: fc.stringMatching(/^\/repo\/[a-z]{1,4}\.(tsx|ts)$/),
  source: fc.string({ maxLength: 20 }),
});
const modules = fc.uniqueArray(moduleOf, {
  maxLength: 12,
  selector: (module) => module.id,
});

test('a remembered build is the build, and a module that has not changed is never transformed twice', async () => {
  await assertProperty(
    'remembering changes when a transform runs, never what it returns',
    fc.asyncProperty(modules, modules, async (first, second) => {
      const store = memoryStore();
      const plain = compiler();
      const remembered = compiler();
      const plugin = rememberTransforms(remembered.plugin, options(store));
      for (const round of [first, second])
        expect(await build(plugin, round)).toEqual(
          await build({ ...plain.plugin, buildEnd() {} }, round)
        );
      // The same build again: only the files never remembered are transformed.
      const before = remembered.ran.length;
      expect(await build(plugin, second)).toEqual(
        await build({ ...plain.plugin, buildEnd() {} }, second)
      );
      const kept = second.filter((module) => module.id.endsWith('.tsx'));
      expect(remembered.ran.length - before).toBe(second.length - kept.length);
      // After a build, the store holds that build's modules and no others.
      expect(store.held.size).toBe(kept.length);
    })
  );
});

test('an unchanged module is answered from the store; a changed one, a renamed one and another salt are not', async () => {
  const store = memoryStore();
  const { plugin, ran } = compiler();
  const remembered = rememberTransforms(plugin, options(store));
  const app = { id: '/repo/app.tsx', source: 'a' };
  expect(await build(remembered, [app])).toEqual([
    '/* compiled /repo/app.tsx */ a',
  ]);
  expect(await build(remembered, [app])).toEqual([
    '/* compiled /repo/app.tsx */ a',
  ]);
  expect(ran).toEqual(['/repo/app.tsx']);
  await build(remembered, [{ ...app, source: 'b' }]);
  await build(remembered, [{ id: '/repo/other.tsx', source: 'b' }]);
  expect(ran).toHaveLength(3);
  // Another plugin version or option is another salt: nothing is shared.
  const next = compiler('recompiled');
  expect(
    await build(rememberTransforms(next.plugin, options(store, 'v2')), [
      { id: '/repo/other.tsx', source: 'b' },
    ])
  ).toEqual(['/* recompiled /repo/other.tsx */ b']);
});

test('a query on a module is not its name, a module left alone stays left alone, and other files pass through', async () => {
  const store = memoryStore();
  const { plugin, ran } = compiler();
  const remembered = rememberTransforms(plugin, options(store));
  const round = [
    { id: '/repo/app.tsx?v=1', source: 'a' },
    { id: '/repo/none.skip.tsx', source: 'a' },
    { id: '/repo/plain.ts', source: 'a' },
  ];
  expect(await build(remembered, round)).toEqual([
    '/* compiled /repo/app.tsx?v=1 */ a',
    null,
    '/* compiled /repo/plain.ts */ a',
  ]);
  await build(remembered, [
    { id: '/repo/app.tsx?v=2', source: 'a' },
    round[1]!,
    round[2]!,
  ]);
  // Only the file outside `include` ran again.
  expect(ran).toHaveLength(4);
});

test('a build that fails forgets nothing', async () => {
  const store = memoryStore();
  const remembered = rememberTransforms(compiler().plugin, options(store));
  await build(remembered, [{ id: '/repo/a.tsx', source: 'a' }]);
  await build(remembered, [{ id: '/repo/b.tsx', source: 'b' }], new Error('x'));
  expect(store.held.size).toBe(2);
});

test('a directory keeps what a build remembers for the next process', async () => {
  const dir = join(import.meta.dirname, '../.cache/transform-cache-test');
  removeTree(dir);
  try {
    const app = [{ id: '/repo/app.tsx', source: 'a' }];
    const first = compiler();
    await build(
      rememberTransforms(
        first.plugin,
        options(directoryTransformStore(join(dir, 'kept')))
      ),
      app
    );
    const second = compiler();
    expect(
      await build(
        rememberTransforms(
          second.plugin,
          options(directoryTransformStore(join(dir, 'kept')))
        ),
        app
      )
    ).toEqual(['/* compiled /repo/app.tsx */ a']);
    expect(second.ran).toEqual([]);
  } finally {
    removeTree(dir);
  }
});
