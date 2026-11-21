// @io-wall-ok — generator script (composition root); writes the generated token files
/**
 * Projects `design-system/tokens.json` (the one token source) into
 * `@pkgs/ui-root-shared-ts`'s `src/design-tokens.json` (the copy its readers
 * import), CSS custom properties, TypeScript token-name unions and a
 * resolved `tokens.json` for other clients and design tools. `--check`
 * writes nothing and fails when any projection is stale.
 */
import path from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

const REPO = path.join(import.meta.dir, '..', '..', '..');
const PKG = path.join(import.meta.dir, '..');
const SOURCE = path.join(REPO, 'design-system', 'tokens.json');
const COPY = path.join(
  PKG,
  '..',
  'ui-root-shared-ts',
  'src',
  'design-tokens.json'
);
const GENERATE =
  'bunx turbo run tokens:generate --filter=@pkgs/ui-root-client-ts';

const check = process.argv.includes('--check');

async function read(file: string): Promise<string> {
  const handle = Bun.file(file);
  return (await handle.exists()) ? await handle.text() : '';
}

let stale = false;
function report(file: string, upToDate: boolean): void {
  const name = slashPath(path.relative(REPO, file));
  if (upToDate) {
    console.log(`${name} up to date`);
    return;
  }
  stale = true;
  console.error(`${name} is stale — run \`${GENERATE}\``);
}

// The renderers import the copy, so it is written (or checked) before they load.
const source = await Bun.file(SOURCE).text();
if (check) report(COPY, (await read(COPY)) === source);
else {
  await Bun.write(COPY, source);
  console.log(`wrote ${slashPath(path.relative(REPO, COPY))}`);
}

const { renderTokensCss } = await import('@pkgs/ui-root-shared-ts/css-vars');
const { renderTokenNamesTs } = await import(
  '@pkgs/ui-root-shared-ts/render-token-names'
);
const { renderTokensJson } = await import(
  '@pkgs/ui-root-shared-ts/render-tokens-json'
);

const OUTPUTS: readonly { readonly file: string; readonly text: string }[] = [
  { file: path.join(PKG, 'src', 'tokens.css'), text: renderTokensCss() },
  { file: path.join(PKG, 'src', 'tokens.json'), text: renderTokensJson() },
  {
    file: path.join(PKG, '..', 'ui-root-shared-ts', 'src', 'token-names.ts'),
    text: renderTokenNamesTs(),
  },
];

for (const output of OUTPUTS) {
  if (!check) {
    await Bun.write(output.file, output.text);
    console.log(`wrote ${slashPath(path.relative(REPO, output.file))}`);
    continue;
  }
  report(output.file, (await read(output.file)) === output.text);
}
if (stale) process.exit(1);
