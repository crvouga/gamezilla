/**
 * The bridge end to end: the access table checked for validity and against
 * a stand-in product bound in three layers, with evidence recorded for every
 * obligation.
 */

import './fixtures/access.binding';

import { describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import { runDecisionSpec } from '@pkgs/dmn-server-ts/bun-test';

const REPORT = join(import.meta.dir, '../.cache/test-reports/bun-test');
rmSync(REPORT, { recursive: true, force: true });

runDecisionSpec({
  packageName: '@pkgs/dmn',
  specPath: join(import.meta.dir, 'fixtures/access.dmn'),
  specUri: 'pkgs/dmn-server-ts/tests/fixtures/access.dmn',
  reportDir: REPORT,
});

describe('evidence', () => {
  test('every obligation of the spec is recorded as passed', () => {
    const { records, malformed } = readEvidence(REPORT);
    expect(malformed).toEqual([]);
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record?.kind).toBe('decisions');
    expect(record?.specUri).toBe(
      'pkgs/dmn-server-ts/tests/fixtures/access.dmn'
    );
    expect(
      record?.obligations.map((o) => [o.id, o.layer, o.status, o.detail])
    ).toEqual([
      [
        'agree:access:application decision',
        'implementation',
        'pass',
        '54 cases',
      ],
      ['agree:access:client gating', 'implementation', 'pass', '36 cases'],
      ['agree:access:server enforcement', 'implementation', 'pass', '54 cases'],
      ['bound', 'implementation', 'pass', '3 layers over access'],
      [
        'complete:access',
        'specification',
        'pass',
        'every input combination has an answer',
      ],
      [
        'consistent:access',
        'specification',
        'pass',
        'no input combination is answered twice',
      ],
      ['valid', 'specification', 'pass', 'decisions: access'],
    ]);
  });
});
