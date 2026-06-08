import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatVaultYamlFromDefaults,
  resolveVaultYamlPath,
} from '../src/vault-yaml';

const repoRoot = join(import.meta.dirname, '../../..');
const outPath = resolveVaultYamlPath(repoRoot);

writeFileSync(outPath, formatVaultYamlFromDefaults(), 'utf8');
process.stdout.write(`[write-vault-yaml] wrote ${outPath}\n`);
