import { describe, expect, test } from 'bun:test';
import { classifyValue, collapseAllState, collectAllContainerPaths, containerBrackets, containerCount, encodePath, entriesOf, expandAllState, formatContainerSummary, formatLeafPreview, formatPathLabel, isContainer, JSON_EXPANSION_INITIAL, resolveExpanded, safeStringify, stringifyForCopy, toggleExpansion } from '@pkgs/ui-devtools-shared/json-view-logic';

describe('classifyValue / isContainer', () => {
  test('classifies primitives and object-likes', () => {
    expect(classifyValue('s')).toBe('string');
    expect(classifyValue(1)).toBe('number');
    expect(classifyValue(1n)).toBe('bigint');
    expect(classifyValue(true)).toBe('boolean');
    expect(classifyValue(null)).toBe('null');
    expect(classifyValue(undefined)).toBe('undefined');
    expect(classifyValue([])).toBe('array');
    expect(classifyValue({})).toBe('object');
    expect(classifyValue(() => 1)).toBe('function');
    expect(classifyValue(Symbol('x'))).toBe('symbol');
    expect(classifyValue(new Date(0))).toBe('date');
    expect(classifyValue(new Error('e'))).toBe('error');
  });

  test('only arrays and objects are containers', () => {
    expect(isContainer('array')).toBe(true);
    expect(isContainer('object')).toBe(true);
    expect(isContainer('date')).toBe(false);
    expect(isContainer('string')).toBe(false);
  });
});

describe('paths', () => {
  test('encodePath is JSON of the segments', () => {
    expect(encodePath([])).toBe('[]');
    expect(encodePath(['a', 0])).toBe('["a",0]');
  });

  test('formatPathLabel uses dot / bracket notation', () => {
    expect(formatPathLabel([])).toBe('$');
    expect(formatPathLabel(['foo', 0, 'bar'])).toBe('$.foo[0].bar');
    expect(formatPathLabel(['needs space', '1x'])).toBe(
      '$["needs space"]["1x"]'
    );
  });
});

describe('entries / counts / brackets', () => {
  test('entriesOf lists indices for arrays and keys for objects', () => {
    expect(entriesOf(['x', 'y'], 'array')).toEqual([
      [0, 'x'],
      [1, 'y'],
    ]);
    expect(entriesOf({ a: 1 }, 'object')).toEqual([['a', 1]]);
    expect(entriesOf('nope', 'string')).toEqual([]);
  });

  test('containerCount and brackets', () => {
    expect(containerCount([1, 2, 3], 'array')).toBe(3);
    expect(containerCount({ a: 1 }, 'object')).toBe(1);
    expect(containerCount(5, 'number')).toBe(0);
    expect(containerBrackets('array')).toEqual({ open: '[', close: ']' });
    expect(containerBrackets('object')).toEqual({ open: '{', close: '}' });
  });
});

describe('formatting', () => {
  test('formatLeafPreview per kind', () => {
    expect(formatLeafPreview('hi', 'string')).toBe('"hi"');
    expect(formatLeafPreview(3, 'number')).toBe('3');
    expect(formatLeafPreview(10n, 'bigint')).toBe('10n');
    expect(formatLeafPreview(null, 'null')).toBe('null');
    expect(formatLeafPreview(undefined, 'undefined')).toBe('undefined');
    expect(formatLeafPreview(new Date(0), 'date')).toBe(
      'Date(1970-01-01T00:00:00.000Z)'
    );
    expect(formatLeafPreview(new TypeError('bad'), 'error')).toBe(
      'TypeError: bad'
    );
    expect(formatLeafPreview(function named() {}, 'function')).toBe(
      'function named() {…}'
    );
    expect(formatLeafPreview(() => 0, 'function')).toMatch(/^function /);
    expect(formatLeafPreview({}, 'object')).toBe('');
  });

  test('formatContainerSummary pluralizes', () => {
    expect(formatContainerSummary(1, 'array')).toBe('1 item');
    expect(formatContainerSummary(2, 'array')).toBe('2 items');
    expect(formatContainerSummary(1, 'object')).toBe('1 key');
    expect(formatContainerSummary(0, 'object')).toBe('0 keys');
  });
});

describe('safeStringify', () => {
  test('pretty prints and never throws on circular refs', () => {
    const a: Record<string, unknown> = { n: 1 };
    a['self'] = a;
    const out = safeStringify(a);
    expect(out).toContain('"n": 1');
    expect(out).toContain('[Circular]');
  });

  test('replaces non-JSON values with stable strings', () => {
    const out = safeStringify({
      big: 2n,
      fn: function go() {},
      sym: Symbol('s'),
      d: new Date(0),
      e: new RangeError('r'),
      u: undefined,
    });
    expect(out).toContain('"big": "2n"');
    expect(out).toContain('"fn": "[Function go]"');
    expect(out).toContain('"sym": "Symbol(s)"');
    expect(out).toContain('"d": "1970-01-01T00:00:00.000Z"');
    expect(out).toContain('"e": "RangeError: r"');
    expect(out).toContain('"u": null');
  });

  test('stringifyForCopy: raw strings, previews for leaves, JSON for containers', () => {
    expect(stringifyForCopy('plain')).toBe('plain');
    expect(stringifyForCopy(4)).toBe('4');
    expect(stringifyForCopy({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe('collectAllContainerPaths', () => {
  test('walks containers depth-first with optional max depth', () => {
    const value = { a: { b: [1, { c: 2 }] }, d: 3 };
    expect(collectAllContainerPaths(value)).toEqual([
      '[]',
      '["a"]',
      '["a","b"]',
      '["a","b",1]',
    ]);
    expect(collectAllContainerPaths(value, { maxDepth: 1 })).toEqual([
      '[]',
      '["a"]',
    ]);
  });

  test('ignores circular references and non-containers', () => {
    const a: Record<string, unknown> = {};
    a['loop'] = a;
    expect(collectAllContainerPaths(a)).toEqual(['[]']);
    expect(collectAllContainerPaths(42)).toEqual([]);
  });
});

describe('expansion state', () => {
  test('depth baseline expands shallow paths only', () => {
    expect(resolveExpanded(JSON_EXPANSION_INITIAL, [], 1)).toBe(true);
    expect(resolveExpanded(JSON_EXPANSION_INITIAL, ['a'], 1)).toBe(false);
    expect(resolveExpanded(JSON_EXPANSION_INITIAL, ['a'], 2)).toBe(true);
  });

  test('toggle flips the resolved value via overrides', () => {
    const toggled = toggleExpansion(JSON_EXPANSION_INITIAL, ['a'], 1);
    expect(resolveExpanded(toggled, ['a'], 1)).toBe(true);
    const back = toggleExpansion(toggled, ['a'], 1);
    expect(resolveExpanded(back, ['a'], 1)).toBe(false);
  });

  test('expandAll / collapseAll baselines', () => {
    const all = expandAllState({ a: { b: {} } }, 8);
    expect(resolveExpanded(all, ['a', 'b'], 0)).toBe(true);
    expect(resolveExpanded(all, ['zzz'], 0)).toBe(true);
    const none = collapseAllState();
    expect(resolveExpanded(none, [], 5)).toBe(false);
    expect(resolveExpanded(none, ['a'], 5)).toBe(false);
  });
});
