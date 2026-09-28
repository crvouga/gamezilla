// @io-wall-ok — runs the bridge over a fixture file and reads the evidence it writes.
/**
 * The bridge end to end, in process: the fixture objective file measured
 * against the healthy fixture product (tests/openslo/), then the evidence it
 * recorded.
 */

import { expect, test } from 'bun:test';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceKey } from '@pkgs/conformance/evidence';
import { runObjectiveSpec } from '@pkgs/openslo/bun-test';
import './openslo/index';

const SPEC_URI = 'pkgs/openslo/tests/fixtures/note-delivery.openslo.yaml';
const REPORT_DIR = join(import.meta.dir, '../.cache/test-bridge');

rmSync(REPORT_DIR, { recursive: true, force: true });

runObjectiveSpec({
  packageName: '@pkgs/openslo',
  specPath: join(import.meta.dir, 'fixtures/note-delivery.openslo.yaml'),
  specUri: SPEC_URI,
  reportDir: REPORT_DIR,
});

test('records one passing obligation per objective, plus validity and binding', () => {
  const file = join(REPORT_DIR, 'evidence', `${evidenceKey(SPEC_URI)}.json`);
  const record = JSON.parse(readFileSync(file, 'utf8')) as {
    kind: string;
    obligations: {
      id: string;
      layer: string;
      status: string;
      detail: string;
    }[];
  };
  expect(record.kind).toBe('objectives');
  expect(record.obligations.map((o) => [o.id, o.layer, o.status])).toEqual([
    ['bound', 'implementation', 'pass'],
    [
      'objective:note-delivery-hourly:every hour this week delivers',
      'implementation',
      'pass',
    ],
    [
      'objective:note-delivery-latency:p95 under 200 ms',
      'implementation',
      'pass',
    ],
    [
      'objective:note-delivery-latency:p99 under 500 ms',
      'implementation',
      'pass',
    ],
    [
      'objective:note-delivery-success:99% of notes delivered',
      'implementation',
      'pass',
    ],
    ['valid', 'specification', 'pass'],
  ]);
  const p95 = record.obligations.find((o) => o.id.endsWith('p95 under 200 ms'));
  expect(p95?.detail).toContain('vs target 0.95');
  expect(p95?.detail).toContain('considered');
});
