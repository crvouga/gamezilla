// @io-wall-ok — generator script (composition root); writes the generated token files
/**
 * Projects `design-system/design-tokens.json` into each language:
 *
 * - `@pkgs/ui-root-shared/design-tokens.json`: the copy TypeScript imports;
 * - `src/tokens.css`: every token as a CSS custom property;
 * - `@pkgs/ui-root-shared/token-names.ts`: the token-name unions props take;
 * - `design-system/swift/design-tokens.swift`: the Swift values.
 *
 * The copy is written first. When it changes, the script starts again so the
 * CSS and name renders import the new document. `--check` writes nothing and
 * fails when any projection is stale.
 */
import path from 'node:path';
import { renderTokensCss } from '@pkgs/ui-root-shared/css-vars';
import type { TokenTree } from '@pkgs/ui-root-shared/design-tokens';
import { renderSwiftTokens } from '@pkgs/ui-root-shared/render-swift-tokens';
import { renderTokenNamesTs } from '@pkgs/ui-root-shared/render-token-names';

const REPO = path.join(import.meta.dir, '..', '..', '..');
const CANONICAL = path.join(REPO, 'design-system', 'design-tokens.json');
const PKG = path.join(import.meta.dir, '..');
const COPY = path.join(
  REPO,
  'pkgs',
  'ui-root-shared',
  'src',
  'design-tokens.json'
);
const GENERATE = 'bun run --filter @pkgs/ui-root-client tokens:generate';

const check = process.argv.includes('--check');

async function read(file: string): Promise<string> {
  const handle = Bun.file(file);
  return (await handle.exists()) ? await handle.text() : '';
}

const canonical = await read(CANONICAL);
if (canonical === '') {
  console.error(`missing ${path.relative(REPO, CANONICAL)}`);
  process.exit(1);
}
if ((await read(COPY)) !== canonical) {
  if (!check) {
    await Bun.write(COPY, canonical);
    const child = Bun.spawn({
      cmd: [process.execPath, import.meta.path, ...process.argv.slice(2)],
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
    });
    process.exit(await child.exited);
  }
}

const swift = renderSwiftTokens(JSON.parse(canonical) as TokenTree);
const OUTPUTS: readonly { readonly file: string; readonly text: string }[] = [
  { file: COPY, text: canonical },
  { file: path.join(PKG, 'src', 'tokens.css'), text: renderTokensCss() },
  {
    file: path.join(PKG, '..', 'ui-root-shared', 'src', 'token-names.ts'),
    text: renderTokenNamesTs(),
  },
  {
    file: path.join(REPO, 'design-system', 'swift', 'design-tokens.swift'),
    text: swift,
  },
];

let stale = false;
for (const output of OUTPUTS) {
  const name = path.relative(REPO, output.file);
  if (!check) {
    await Bun.write(output.file, output.text);
    console.log(`wrote ${name}`);
    continue;
  }
  if ((await read(output.file)) === output.text) {
    console.log(`${name} up to date`);
    continue;
  }
  stale = true;
  console.error(`${name} is stale — run \`${GENERATE}\``);
}
if (stale) process.exit(1);
