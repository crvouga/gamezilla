import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { decodeBaselineLog, encodeBaselineLog } from './storybook-baseline-log';

function maskedLog(patch: string): string {
  return encodeBaselineLog(patch)
    .split('\n')
    .map((line) => `job\tstep\t2026-11-03T10:00:00Z ${line}`)
    .join('\n')
    .replaceAll('1', '***')
    .replaceAll('auto', '***')
    .replaceAll('dev', '***');
}

test('public binary patch bytes survive short-value redaction in job logs', () => {
  // regression: storybook-baseline-log-masking
  const patch =
    'diff --git a/image-1.png b/image-1.png\nGIT binary patch\nliteral 1\nauto1dev\n';
  expect(decodeBaselineLog(maskedLog(patch))).toBe(patch);
});

test('arbitrary public patch text round-trips through prefixed, masked logs', async () => {
  await assertProperty(
    'log transport preserves public patch bytes',
    fc.property(fc.string(), (patch) => {
      expect(decodeBaselineLog(maskedLog(patch))).toBe(patch);
    })
  );
});

test('an incomplete log cannot supply a baseline patch', () => {
  expect(() => decodeBaselineLog('unrelated log')).toThrow('no complete');
  expect(() =>
    decodeBaselineLog(encodeBaselineLog('patch').slice(0, -1))
  ).toThrow('no complete');
});
