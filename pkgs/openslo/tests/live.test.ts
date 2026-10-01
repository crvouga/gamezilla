import { describe, expect, test } from 'bun:test';
import { isLiveObjectiveSource } from '@pkgs/openslo/live';

describe('isLiveObjectiveSource', () => {
  test('the first non-empty line is exactly # live', () => {
    expect(isLiveObjectiveSource('# live\nkind: SLO\n')).toBe(true);
    expect(isLiveObjectiveSource('\n# live\n')).toBe(true);
    expect(
      isLiveObjectiveSource('# People can open the app\nkind: SLO\n')
    ).toBe(false);
    expect(isLiveObjectiveSource('# live-only\n')).toBe(false);
    expect(isLiveObjectiveSource('')).toBe(false);
  });
});
