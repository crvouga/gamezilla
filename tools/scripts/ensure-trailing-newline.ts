// @io-wall-ok — tools composition root
import { readFileSync, writeFileSync } from 'node:fs';

for (const path of process.argv.slice(2)) {
  const s = readFileSync(path, 'utf8');
  if (!s.endsWith('\n')) {
    writeFileSync(path, `${s}\n`);
  }
}
