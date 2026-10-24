// @io-wall-ok — maintenance entry wires package-owned spec evidence into its consumer.
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { REPO_ROOT, specPackages } from './spec-packages';

const SOURCES = 'apps/product-ts/scripts/ui-quality/sources.json';
const TURBO = 'apps/product-ts/turbo.json';

export async function syncUiQualitySources(store: ObjectStore): Promise<void> {
  const owners = specPackages()
    .filter((pkg) => !pkg.dir.startsWith('pkgs/') && pkg.specDomains.length > 0)
    .sort((a, b) => a.dir.localeCompare(b.dir));
  const sources = await Promise.all(
    owners.map(async (pkg) => {
      const raw = await readUtf8(store, `${pkg.dir}/package.json`);
      if (raw === null) throw new Error(`${pkg.dir}/package.json is missing`);
      const declaration = JSON.parse(raw) as { readonly specParts: number };
      if (!Number.isInteger(declaration.specParts) || declaration.specParts < 1)
        throw new Error(`${pkg.dir} has no declared specification parts`);
      return {
        package: pkg.name,
        directory: pkg.dir,
        parts: declaration.specParts,
      };
    })
  );
  const dependencies = sources.flatMap((source) =>
    Array.from(
      { length: source.parts },
      (_, part) => `${source.package}#test:spec:${part}`
    )
  );
  const current = await readUtf8(store, TURBO);
  if (current === null) throw new Error(`${TURBO} is missing`);
  const pattern = /("prepare:ui-quality": \{\n {6}"dependsOn": )\[[\s\S]*?\]/;
  if (!pattern.test(current))
    throw new Error(`${TURBO} has no visual evidence dependencies`);
  const array = JSON.stringify(dependencies, null, 2).replaceAll(
    '\n',
    '\n      '
  );
  const updated = current.replace(
    pattern,
    (_match, prefix: string) => `${prefix}${array}`
  );
  await writeUtf8(
    store,
    SOURCES,
    `${JSON.stringify(sources, null, 2)}\n`,
    'application/json'
  );
  if (current !== updated)
    await writeUtf8(store, TURBO, updated, 'application/json');
}

if (import.meta.main) {
  await syncUiQualitySources(
    createNodeFsObjectStore({
      rootDir: REPO_ROOT,
      fs: wallNodeFs(),
      layout: 'tree',
    })
  );
}
