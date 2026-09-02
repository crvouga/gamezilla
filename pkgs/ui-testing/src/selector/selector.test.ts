import { describe, expect, it } from 'bun:test';
import { formatTestId, formatTestIdPath } from './format';
import { testIdSelector } from './selector';

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
