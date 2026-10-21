/**
 * Regression: `bun test --parallel` workers wrote the same migrated harness seed
 * at once, and each process named its tmp file `<key>.1.tmp` — one worker's
 * `rename` moved the other's tmp away, which then failed `ENOENT` and took a
 * whole spec suite down on a cold cache. Several processes putting one key
 * concurrently must all succeed and leave one whole value.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WRITERS = 6;
const PUTS = 40;
const dir = mkdtempSync(join(tmpdir(), 'object-store-xproc-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const WRITER = join(import.meta.dir, 'put-writer.ts');

describe('ObjectStoreImplNodeFs across processes', () => {
  test('concurrent puts of one key from several processes all succeed', async () => {
    const procs = Array.from({ length: WRITERS }, () =>
      Bun.spawn(['bun', WRITER, dir, String(PUTS)], {
        stderr: 'pipe',
        stdout: 'ignore',
      })
    );
    const results = await Promise.all(
      procs.map(async (p) => ({
        code: await p.exited,
        stderr: await new Response(p.stderr).text(),
      }))
    );
    for (const r of results) {
      expect(r.stderr).toBe('');
      expect(r.code).toBe(0);
    }
    expect(readFileSync(join(dir, 'seed.json'), 'utf8')).toHaveLength(
      64 * 1024
    );
  }, 60_000);
});
