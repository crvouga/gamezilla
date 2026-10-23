// @io-wall-ok — artifact producer collects cached suite outputs before the local gate.
import { join, resolve } from 'node:path';
import { compileFrameCss } from '@libs/harness-ts/wall-frame-css';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { collectArtifacts } from './collect';
import { createSnapshotFingerprint } from './fingerprint';
import sources from './ui-quality/sources.json';

const ROOT = resolve(import.meta.dir, '../../..');
const OUTPUT = join(ROOT, 'apps/product-ts/.cache/ui-quality-inputs');

function store(rootDir: string) {
  return createNodeFsObjectStore({ rootDir, fs: wallNodeFs(), layout: 'tree' });
}

export async function prepareInputs(): Promise<void> {
  const output = store(OUTPUT);
  await output.deleteMany(await output.listKeys());
  const stylesheet = compileFrameCss(ROOT);
  const manifest = await collectArtifacts(
    sources.flatMap((source) =>
      Array.from({ length: source.parts }, (_, part) => ({
        package: source.package,
        bucket: `part-${part}`,
        store: store(
          join(ROOT, source.directory, '.cache/harness-report', `part-${part}`)
        ),
      }))
    ),
    output,
    createSnapshotFingerprint(stylesheet)
  );
  await writeUtf8(output, 'frame.css', stylesheet, 'text/css');
  console.log(
    `[ui-quality] ${manifest.reports} report(s), ${manifest.references} references, ${manifest.artifacts.length} unique visual inputs.`
  );
}

if (import.meta.main) await prepareInputs();
