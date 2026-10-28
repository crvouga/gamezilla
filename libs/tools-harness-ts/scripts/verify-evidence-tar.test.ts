import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { archiveEntries, extractEvidence } from './verify-evidence-archive';
import { packShardEvidence } from './verify-evidence-pack';

// regression: verify-evidence-system-tar-windows
// Verify runs 40596596039 and 40599165745: the Windows runner's tar could not
// list the shards' archives, so verify:end read every verdict as missing. The
// archives are Bun's own now, and their members carry their bytes (a lazy
// Bun.file() member was packed empty).
test('shard evidence packs, lists and extracts its exact bytes without a system tar', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-tar-'));
  const restored = mkdtempSync(join(tmpdir(), 'evidence-restored-'));
  try {
    const files: Record<string, string> = {
      '.cache/verify-ci/results/shard-0.json': '{"verdict":"pass"}',
      '.cache/verify-ci/plan.payload': 'plan',
      'libs/a/.cache/harness-report/[spec] {part}/trace.ndjson': 'trace',
      'libs/a/.cache/harness-report/[spec] {part}/nested/shot.txt': 'shot',
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    packShardEvidence(root, 0, [
      '.cache/verify-ci/results/shard-0.json',
      '.cache/verify-ci/plan.payload',
      'libs/a/.cache/harness-report/[spec] {part}',
    ]);
    const evidence = join(root, '.cache/verify-ci/evidence-0.tar.gz');
    expect(
      archiveEntries(join(root, '.cache/verify-ci/results-0.tar.gz'))
    ).toEqual([
      '.cache/verify-ci/results/shard-0.json',
      '.cache/verify-ci/plan.payload',
    ]);
    const listed = archiveEntries(evidence);
    expect([...listed].sort()).toEqual(Object.keys(files).sort());
    extractEvidence(evidence, listed, restored);
    for (const [path, content] of Object.entries(files))
      expect(readFileSync(join(restored, path), 'utf8')).toBe(content);
    expect(() =>
      extractEvidence(evidence, ['not/in/the/archive.json'], restored)
    ).toThrow('Cannot extract selected shard evidence');
  } finally {
    removeTree(root, { whenLocked: 'leave' });
    removeTree(restored, { whenLocked: 'leave' });
  }
});
