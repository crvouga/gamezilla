/**
 * All-or-nothing transaction proof: the commit gate refuses to write a
 * single byte when anything is off — parse failures, unstable (non-
 * fixpoint) outputs, or count mismatches.
 */

import { describe, expect, test } from 'vitest';
import { parseArgs } from '../cli-io';
import { formatReport } from '../report';
import { runCodemod, verifyStable } from '../run-codemod';

const IMPORT = `import { Box } from '@pkgs/ui';\n`;

describe('all-or-nothing commit', () => {
  test('clean run is stable and counts add up', () => {
    const result = runCodemod(
      {
        'a.tsx': `${IMPORT}export const A = () => <Box sx={{ p: 1 }} />;`,
        'b.tsx': `${IMPORT}export const B = (p: { sx: never }) => <Box sx={p.sx} />;`,
      },
      { dryRun: true }
    );
    expect(result.summary.parseFailures).toBe(0);
    expect(result.unstable).toEqual([]);
    expect(result.summary.totalConvertedA).toBe(1);
    expect(result.summary.totalConvertedB).toBe(1);
    expect(result.summary.totalManual).toBe(0);
    const changed = result.outputs.filter((o) => o.changed);
    expect(changed.length).toBe(2);
  });

  test('parse failure is reported, output untouched', () => {
    const bad = `${IMPORT}export const A = <Box sx={{ p: ;`;
    const result = runCodemod({ 'bad.tsx': bad }, { dryRun: true });
    expect(result.summary.parseFailures).toBe(1);
    expect(result.outputs[0]?.nextText).toBe(bad);
    expect(result.outputs[0]?.changed).toBe(false);
  });

  test('report formats one line per file plus totals', () => {
    const result = runCodemod(
      { 'a.tsx': `${IMPORT}export const A = () => <Box sx={{ p: 1 }} />;` },
      { dryRun: true }
    );
    const text = formatReport(result.summary);
    expect(text).toContain('a.tsx');
    expect(text).toContain('convertedA=1');
    expect(text).toContain('mode=dry-run');
  });

  test('verifyStable flags non-fixpoint outputs', () => {
    expect(
      verifyStable([
        {
          path: 'x.tsx',
          nextText: `${IMPORT}export const A = () => <Box sx={{ p: 1 }} />;`,
          changed: true,
        },
      ])
    ).toEqual(['x.tsx']);
    expect(verifyStable([])).toEqual([]);
  });
});

describe('cli arg guards', () => {
  test('dry-run by default with standard globs', () => {
    expect(parseArgs([])).toEqual({
      globs: ['apps/client/src', 'libs', 'pkgs/ui/src'],
      write: false,
    });
  });
  test('--write enables the commit path', () => {
    expect(parseArgs(['libs/chess', '--write']).write).toBe(true);
  });
  test('--write with --dry-run is rejected', () => {
    expect(() => parseArgs(['--write', '--dry-run'])).toThrowError(
      '--write and --dry-run conflict'
    );
  });
  test('unknown flags are rejected', () => {
    expect(() => parseArgs(['--yolo'])).toThrowError('unknown flag');
  });
});
