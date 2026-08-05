import { describe, expect, it } from 'bun:test';
import { formatSelector } from './format';
import { by, first, nth } from './selector';

describe('by selectors', () => {
  it('builds portable selector objects', () => {
    expect(by.testId('email')).toEqual({ kind: 'testId', value: 'email' });
    expect(by.text('Hello', { exact: false })).toEqual({
      kind: 'text',
      value: 'Hello',
      exact: false,
    });
    expect(by.label('Email')).toEqual({ kind: 'label', value: 'Email' });
    expect(by.role('button', 'Submit')).toEqual({
      kind: 'role',
      role: 'button',
      name: 'Submit',
    });
  });

  it('applies first/nth modifiers', () => {
    expect(first(by.role('heading', 'Spaces'))).toEqual({
      kind: 'role',
      role: 'heading',
      name: 'Spaces',
      nth: 0,
    });
    expect(nth(by.testId('row'), 2)).toEqual({
      kind: 'testId',
      value: 'row',
      nth: 2,
    });
  });

  it('formats selectors for errors', () => {
    expect(formatSelector(by.testId('x'))).toBe('testId("x")');
    expect(formatSelector(by.role('button', 'Go'))).toBe(
      'role("button", name: "Go")'
    );
    expect(formatSelector(first(by.testId('x')))).toBe('testId("x", nth: 0)');
  });
});
