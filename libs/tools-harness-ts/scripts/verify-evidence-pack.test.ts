import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { archiveEntries, extractEvidence } from './verify-evidence-archive';
import { packShardEvidence } from './verify-evidence-pack';

// regression: reports-verdict-downloads-snapshots
test('verdict archives contain only results and the plan while rendered evidence is compressed losslessly', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'shard-evidence-'));
  const directory = join(fixture, '.cache/verify-ci');
  const result = '.cache/verify-ci/results/shard-0.json';
  const payload = '.cache/verify-ci/plan.payload';
  const rendered = '.cache/verify-ci/failed-reports/rendered.html';
  const document =
    '<div data-component="ScreenBase">Recorded application state</div>'.repeat(
      10_000
    );
  try {
    mkdirSync(join(directory, 'results'), { recursive: true });
    mkdirSync(join(directory, 'failed-reports'));
    writeFileSync(join(fixture, result), '{"index":0,"verdict":1}');
    writeFileSync(join(fixture, payload), 'immutable-plan');
    writeFileSync(join(fixture, rendered), document);
    packShardEvidence(fixture, 0, [result, payload, rendered]);
    const verdict = join(directory, 'results-0.tar.gz');
    const evidence = join(directory, 'evidence-0.tar.gz');
    expect(archiveEntries(verdict)).toEqual([result, payload]);
    expect(archiveEntries(evidence)).toEqual([result, payload, rendered]);
    expect(statSync(evidence).size).toBeLessThan(document.length / 4);
    const restored = join(fixture, 'restored');
    extractEvidence(evidence, archiveEntries(evidence), restored);
    expect(readFileSync(join(restored, rendered), 'utf8')).toBe(document);
    expect(readFileSync(join(restored, result), 'utf8')).toBe(
      '{"index":0,"verdict":1}'
    );
  } finally {
    removeTree(fixture, { whenLocked: 'leave' });
  }
});
