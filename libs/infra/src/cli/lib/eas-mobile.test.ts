import { expect, test } from 'bun:test';

import { withNodeMaxOldSpaceSize } from './eas-mobile';

test('withNodeMaxOldSpaceSize sets NODE_OPTIONS when unset', () => {
  const env = withNodeMaxOldSpaceSize({}, 8192);
  expect(env['NODE_OPTIONS']).toBe('--max-old-space-size=8192');
});

test('withNodeMaxOldSpaceSize appends when other NODE_OPTIONS exist', () => {
  const env = withNodeMaxOldSpaceSize(
    { NODE_OPTIONS: '--enable-source-maps' },
    8192
  );
  expect(env['NODE_OPTIONS']).toBe(
    '--enable-source-maps --max-old-space-size=8192'
  );
});

test('withNodeMaxOldSpaceSize replaces an existing max-old-space-size', () => {
  const env = withNodeMaxOldSpaceSize(
    { NODE_OPTIONS: '--max-old-space-size=2048 --no-warnings' },
    8192
  );
  expect(env['NODE_OPTIONS']).toBe(
    '--max-old-space-size=8192 --no-warnings'
  );
});
