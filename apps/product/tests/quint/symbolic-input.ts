// @io-wall-ok — explicit bounded symbolic input; no transitions are removed.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheValueParameters } from '@pkgs/quint-server/cache-value-parameters';
import { MODEL_DIR, REPORT_DIR } from './campaign-config';
import { campaignImports } from './campaign-imports';
import { sourceDigest } from './source-digest';

const REDUCED = new Set([
  'offline-replication',
  'access-sync',
  'multiplayer',
  'privacy-lifecycle',
  'whole-system',
  'recovery',
]);

export async function withSymbolicInput<T>(
  name: string,
  check: (path: string, bound: string) => Promise<T>,
  reportDir = REPORT_DIR
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'product-quint-symbolic-'));
  try {
    cpSync(MODEL_DIR, dir, { recursive: true });
    const path = join(dir, 'universe.qnt');
    const source = readFileSync(path, 'utf8');
    const original = 'Set(0, 1, 2, 3)';
    if (source.split(original).length !== 2)
      throw new Error('Unexpected device universe.');
    if (REDUCED.has(name))
      writeFileSync(path, source.replace(original, 'Set(0, 1, 2)'));
    for (const imported of campaignImports(name)) {
      const input = join(dir, `${imported}.qnt`);
      writeFileSync(input, cacheValueParameters(readFileSync(input, 'utf8')));
    }
    const sha = sourceDigest(dir);
    const clients = REDUCED.has(name)
      ? 'Three symbolic clients: two for actor zero, one for actor one; any can sign into actor two.'
      : 'Original actor/client bounds.';
    const bound = `${clients} All three actors, two spaces, three puzzles and all transitions remain. Value parameters and repeated record fields use equivalent cached LET bindings. Symbolic source-set SHA256: ${sha}.`;
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      join(reportDir, `${name}.symbolic-bound.json`),
      `${JSON.stringify({ model: name, sourceSetSha256: sourceDigest(), symbolicSourceSetSha256: sha, bound }, null, 2)}\n`
    );
    return await check(join(dir, `${name}.qnt`), bound);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
