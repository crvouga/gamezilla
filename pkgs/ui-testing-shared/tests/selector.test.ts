import { describe, expect, it } from 'bun:test';
import { formatTestId, formatTestIdPath } from '@pkgs/ui-testing-shared/format';
import { testIdSelector } from '@pkgs/ui-testing-shared/selector';

describe('testId helpers', () => {
  it('builds a testId selector object', () => {
    expect(testIdSelector('email')).toEqual({
      kind: 'testId',
      value: 'email',
    });
  });

  it('formats testIds for errors', () => {
    expect(formatTestId('x')).toBe('testId("x")');
  });

  it('formats nested testId paths', () => {
    expect(formatTestIdPath(['modal', 'ok'])).toBe(
      'testId("modal") >> testId("ok")'
    );
  });
});
