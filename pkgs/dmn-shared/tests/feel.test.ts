import { describe, expect, test } from 'bun:test';
import type { FeelValue, UnaryTest } from '@pkgs/dmn-shared/feel';
import {
  matches,
  numericEndpoints,
  parseLiteral,
  parseUnaryTests,
} from '@pkgs/dmn-shared/feel';

function tests(text: string): UnaryTest {
  const parsed = parseUnaryTests(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** Which of `values` the test matches. */
function matched(text: string, values: readonly FeelValue[]): FeelValue[] {
  const test = tests(text);
  return values.filter((v) => matches(test, v));
}

const NUMBERS = [-1, 0, 5, 9, 10, 11, 19, 20, 21];

describe('unary tests', () => {
  test('"-" matches anything, null included', () => {
    expect(matched('-', ['a', 1, true, null])).toEqual(['a', 1, true, null]);
    expect(matched('  -  ', [null])).toEqual([null]);
  });

  test('a literal matches itself and nothing of another type', () => {
    expect(matched('"plus"', ['plus', 'free'])).toEqual(['plus']);
    expect(matched('= "plus"', ['plus', 'free'])).toEqual(['plus']);
    expect(matched('20', [20, '20', 21])).toEqual([20]);
    expect(matched('-1.5', [-1.5, 1.5])).toEqual([-1.5]);
    expect(matched('true', [true, false, 'true'])).toEqual([true]);
    expect(matched('false', [true, false])).toEqual([false]);
    expect(matched('null', [null, 'null', 0])).toEqual([null]);
  });

  test('comparisons', () => {
    expect(matched('< 10', NUMBERS)).toEqual([-1, 0, 5, 9]);
    expect(matched('<= 10', NUMBERS)).toEqual([-1, 0, 5, 9, 10]);
    expect(matched('> 19', NUMBERS)).toEqual([20, 21]);
    expect(matched('>=19', NUMBERS)).toEqual([19, 20, 21]);
    expect(matched('< -0.5', NUMBERS)).toEqual([-1]);
    expect(matched('< 10', ['5', null])).toEqual([]);
  });

  test('intervals, open or closed at either end', () => {
    expect(matched('[10..20]', NUMBERS)).toEqual([10, 11, 19, 20]);
    expect(matched('(10..20)', NUMBERS)).toEqual([11, 19]);
    expect(matched(']10..20[', NUMBERS)).toEqual([11, 19]);
    expect(matched('[10..20)', NUMBERS)).toEqual([10, 11, 19]);
    expect(matched('( 10 .. 20 ]', NUMBERS)).toEqual([11, 19, 20]);
  });

  test('a list matches when any member does; not(…) when none does', () => {
    expect(matched('"guest", "free"', ['guest', 'free', 'plus'])).toEqual([
      'guest',
      'free',
    ]);
    expect(matched('< 0, [10..11], 21', NUMBERS)).toEqual([-1, 10, 11, 21]);
    expect(matched('not("guest", "free")', ['guest', 'free', 'plus'])).toEqual([
      'plus',
    ]);
    expect(matched('not ( < 20 )', NUMBERS)).toEqual([20, 21]);
  });

  test('strings keep their escapes', () => {
    expect(matched(String.raw`"say \"hi\"\\"`, ['say "hi"\\'])).toEqual([
      'say "hi"\\',
    ]);
  });

  test('the numbers a test compares against', () => {
    expect(numericEndpoints(tests('< 20'))).toEqual([20]);
    expect(numericEndpoints(tests('not([1..5], 9, "x")'))).toEqual([1, 5, 9]);
    expect(numericEndpoints(tests('-'))).toEqual([]);
  });

  const invalid: readonly [string, string][] = [
    ['', 'expected a value'],
    ['guest', 'expected a value'],
    ['"open', 'not closed'],
    ['[1..', 'expected a number'],
    ['[5..1]', 'is empty'],
    ['[1 2]', 'expected ".."'],
    ['< "a"', 'expected a number'],
    ['"a",', 'expected a value'],
    ['-, "a"', 'expected a number'],
    ['"a" "b"', 'unexpected'],
    ['not("a"', 'expected ")"'],
    [String.raw`"\q"`, 'unknown escape'],
    ['truth', 'expected a value'],
  ];
  for (const [text, message] of invalid) {
    test(`refuses ${JSON.stringify(text)}`, () => {
      const parsed = parseUnaryTests(text);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toContain(message);
    });
  }
});

describe('literals', () => {
  test('output entries are literals', () => {
    expect(parseLiteral(' "allow" ')).toEqual({ ok: true, value: 'allow' });
    expect(parseLiteral('42')).toEqual({ ok: true, value: 42 });
    expect(parseLiteral('true')).toEqual({ ok: true, value: true });
    expect(parseLiteral('null')).toEqual({ ok: true, value: null });
  });

  test('a test is not a literal', () => {
    expect(parseLiteral('< 20').ok).toBe(false);
    expect(parseLiteral('"a", "b"').ok).toBe(false);
    expect(parseLiteral('-').ok).toBe(false);
  });
});
