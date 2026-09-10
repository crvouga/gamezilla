/**
 * Probe: run transformFile on one file and print the output text.
 * Run: bun pkgs/ui/codemod/tests/dump-transform.ts <path>
 */

import { readFileSync } from 'node:fs';
import { transformFile } from '../transform';

const path = process.argv[2];
if (path === undefined) {
  process.stdout.write('usage: bun dump-transform.ts <path>\n');
  process.exit(1);
}
const text = readFileSync(path, 'utf8');
const result = transformFile(path, text);
process.stdout.write(
  `changed=${String(result.changed)} parseError=${result.parseError ?? 'none'} manual=${result.manual.length}\n`
);
process.stdout.write(result.text);
process.stdout.write('\n');
