// @io-wall-ok — artifact producer collects cached suite outputs before the local gate.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileFrameCss } from '@libs/harness/ci/wall-frame-css';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { collectArtifacts } from './collect';
import { snapshotFingerprint } from './fingerprint';
import sources from './sources.json';

const ROOT = resolve(import.meta.dir, '../../../..');
const OUTPUT = join(ROOT, 'apps/product/.cache/ui-quality-inputs');

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
    (html) => snapshotFingerprint(html, stylesheet)
  );
  const font = await readFile(
    join(ROOT, 'pkgs/ui/src/theme/nunito-latin.woff2')
  );
  const fontCss = (
    await readFile(join(ROOT, 'pkgs/ui/src/theme/fonts.css'), 'utf8')
  ).replace(
    './nunito-latin.woff2',
    `data:font/woff2;base64,${font.toString('base64')}`
  );
  await writeUtf8(output, 'frame.css', `${fontCss}\n${stylesheet}`, 'text/css');
  console.log(
    `[ui-quality] ${manifest.reports} report(s), ${manifest.references} references, ${manifest.artifacts.length} unique visual inputs.`
  );
}

if (import.meta.main) await prepareInputs();
