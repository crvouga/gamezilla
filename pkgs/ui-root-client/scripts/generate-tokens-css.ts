// @io-wall-ok — generator script (composition root); writes the generated token files
/**
 * Renders everything derived from `@pkgs/ui-root-shared/design-tokens.json`:
 *
 * - `src/tokens.css`: every token as a CSS custom property;
 * - `@pkgs/ui-root-shared/token-names.ts`: the token-name unions props take.
 *
 * `--check` writes nothing and fails when either file is stale.
 */
import path from 'node:path';
import { renderTokensCss } from '@pkgs/ui-root-shared/css-vars';
import { renderTokenNamesTs } from '@pkgs/ui-root-shared/render-token-names';

const PKG = path.join(import.meta.dir, '..');
const OUTPUTS: readonly { readonly file: string; readonly text: string }[] = [
  { file: path.join(PKG, 'src', 'tokens.css'), text: renderTokensCss() },
  {
    file: path.join(PKG, '..', 'ui-root-shared', 'src', 'token-names.ts'),
    text: renderTokenNamesTs(),
  },
];
const check = process.argv.includes('--check');

let stale = false;
for (const output of OUTPUTS) {
  const name = path.relative(path.join(PKG, '..', '..'), output.file);
  if (!check) {
    await Bun.write(output.file, output.text);
    console.log(`wrote ${name}`);
    continue;
  }
  const file = Bun.file(output.file);
  const current = (await file.exists()) ? await file.text() : '';
  if (current === output.text) {
    console.log(`${name} up to date`);
    continue;
  }
  stale = true;
  console.error(
    `${name} is stale — run \`bun run --filter @pkgs/ui-root-client tokens:generate\``
  );
}
if (stale) process.exit(1);
