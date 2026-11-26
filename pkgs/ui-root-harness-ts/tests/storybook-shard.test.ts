import { expect, test } from 'bun:test';
import { storybookShard } from '../storybook/shard';

test('each nightly worker receives its one-based Playwright partition', () => {
  for (let current = 1; current <= 8; current++) {
    expect(storybookShard(`${current}/8`)).toEqual({ current, total: 8 });
  }
});

test.each(['', '0/8', '1/0', '9/8', '1/8.5'])(
  'a malformed visual partition %j fails before the suite starts',
  (value) => {
    expect(() => storybookShard(value)).toThrow('STORYBOOK_SHARD');
  }
);
