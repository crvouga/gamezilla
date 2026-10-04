// @io-wall-ok — generator script (composition root); writes src/tokens.css
import path from 'node:path';
import { renderTokensCss } from '@pkgs/ui-root-shared/css-vars';

const OUT = path.join(import.meta.dir, '..', 'src', 'tokens.css');
const check = process.argv.includes('--check');
const next = renderTokensCss();

if (check) {
  const file = Bun.file(OUT);
  const current = (await file.exists()) ? await file.text() : '';
  if (current !== next) {
    console.error(
      `tokens.css is stale — run \`bun run --filter @pkgs/ui-root-client tokens:generate\``
    );
    process.exit(1);
  }
  console.log('tokens.css up to date');
} else {
  await Bun.write(OUT, next);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
}
