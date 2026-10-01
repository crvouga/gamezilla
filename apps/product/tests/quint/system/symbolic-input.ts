// @io-wall-ok — explicit bounded symbolic input; no transitions are removed.
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MODEL_DIR, modelPath, REPORT_DIR } from './campaign-config';
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
  check: (path: string, bound: string) => Promise<T>
): Promise<T> {
  if (!REDUCED.has(name))
    return check(modelPath(name), 'original actor/client bounds');
  const dir = mkdtempSync(join(tmpdir(), 'product-quint-symbolic-'));
  try {
    cpSync(MODEL_DIR, dir, { recursive: true });
    const path = join(dir, 'universe.qnt');
    const source = readFileSync(path, 'utf8');
    const original = 'Set(0, 1, 2, 3)';
    if (source.split(original).length !== 2)
      throw new Error('Unexpected device universe.');
    writeFileSync(path, source.replace(original, 'Set(0, 1, 2)'));
    const sha = sourceDigest(dir);
    const bound = `Three symbolic clients: two for actor zero, one for actor one; any can sign into actor two. All three actors, two spaces, three puzzles and all transitions remain. Symbolic source-set SHA256: ${sha}.`;
    writeFileSync(
      join(REPORT_DIR, `${name}.symbolic-bound.json`),
      `${JSON.stringify({ model: name, sourceSetSha256: sourceDigest(), symbolicSourceSetSha256: sha, bound }, null, 2)}\n`
    );
    return await check(join(dir, `${name}.qnt`), bound);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
