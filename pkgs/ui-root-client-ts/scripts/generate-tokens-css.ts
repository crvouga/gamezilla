// @io-wall-ok — generator script (composition root); writes the generated token files
/**
 * Projects `@pkgs/ui-root-shared-ts`'s `src/design-tokens.json` into CSS custom
 * properties, TypeScript token-name unions and a resolved `tokens.json` for
 * other clients and design tools. `--check` writes nothing and
 * fails when any projection is stale.
 */
import path from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { renderTokensCss } from '@pkgs/ui-root-shared-ts/css-vars';
import { renderTokenNamesTs } from '@pkgs/ui-root-shared-ts/render-token-names';
import { renderTokensJson } from '@pkgs/ui-root-shared-ts/render-tokens-json';

const REPO = path.join(import.meta.dir, '..', '..', '..');
const PKG = path.join(import.meta.dir, '..');
const GENERATE =
  'bunx turbo run tokens:generate --filter=@pkgs/ui-root-client-ts';

const check = process.argv.includes('--check');

async function read(file: string): Promise<string> {
  const handle = Bun.file(file);
  return (await handle.exists()) ? await handle.text() : '';
}

const OUTPUTS: readonly { readonly file: string; readonly text: string }[] = [
  { file: path.join(PKG, 'src', 'tokens.css'), text: renderTokensCss() },
  { file: path.join(PKG, 'src', 'tokens.json'), text: renderTokensJson() },
  {
    file: path.join(PKG, '..', 'ui-root-shared-ts', 'src', 'token-names.ts'),
    text: renderTokenNamesTs(),
  },
];

let stale = false;
for (const output of OUTPUTS) {
  const name = slashPath(path.relative(REPO, output.file));
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
