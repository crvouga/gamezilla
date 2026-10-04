import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import {
  decodeItfTrace,
  decodeItfValue,
  quintEqual,
  renderQuint,
} from '@pkgs/quint-shared/itf';
import fc from 'fast-check';

/** Values as Quint writes them, next to what they decode to. */
const leaf = fc.oneof(
  fc.boolean(),
  fc.string({ maxLength: 4 }),
  fc.integer({ min: -1000, max: 1000 })
);

describe('itf values', () => {
  test('a set renders the same whatever order its elements came in', () => {
    assertProperty(
      'set order',
      fc.property(fc.uniqueArray(leaf, { maxLength: 6 }), (items) => {
        const reversed = [...items].reverse();
        expect(renderQuint(new Set(items))).toBe(
          renderQuint(new Set(reversed))
        );
      })
    );
  });

  test('a map renders the same whatever order its entries came in', () => {
    assertProperty(
      'map order',
      fc.property(
        fc.uniqueArray(fc.tuple(fc.string({ maxLength: 4 }), leaf), {
          maxLength: 6,
          selector: ([k]) => k,
        }),
        (entries) => {
          const reversed = [...entries].reverse();
          expect(quintEqual(new Map(entries), new Map(reversed))).toBe(true);
        }
      )
    );
  });

  test('decoding keeps what ITF says and renders as Quint would', () => {
    const decoded = decodeItfValue({
      hosts: { '#map': [['alice', { '#set': ['s2', 's1'] }]] },
      count: { '#bigint': '12' },
      pair: { '#tup': [true, 'x'] },
      phase: { tag: 'Hosting', value: 'alice' },
      idle: { tag: 'Idle', value: { '#tup': [] } },
    });
    expect(renderQuint(decoded)).toBe(
      '{ count: 12, hosts: Map("alice" -> Set("s1", "s2")), idle: Idle, pair: (true, "x"), phase: Hosting("alice") }'
    );
  });

  test('a missing product value renders, and differs from every model value', () => {
    const observed = new Map([['n1', null as unknown as QuintValue]]);
    expect(renderQuint(observed)).toBe('Map("n1" -> null)');
    expect(quintEqual(observed, new Map([['n1', 'null']]))).toBe(false);
  });

  test('a bigint beyond the safe range stays a bigint', () => {
    const huge = decodeItfValue({ '#bigint': '123456789012345678901234' });
    expect(typeof huge).toBe('bigint');
  });

  test('a trace keeps the action and only the values drawn', () => {
    const trace = decodeItfTrace({
      vars: ['state', 'mbt::actionTaken', 'mbt::nondetPicks'],
      states: [
        {
          state: 'closed',
          'mbt::actionTaken': 'init',
          'mbt::nondetPicks': { who: { tag: 'None', value: { '#tup': [] } } },
        },
        {
          state: 'open',
          'mbt::actionTaken': 'open',
          'mbt::nondetPicks': { who: { tag: 'Some', value: 'ana' } },
        },
      ],
    });
    expect(trace.vars).toEqual(['state']);
    expect(trace.states.map((s) => [s.action, s.picks])).toEqual([
      ['init', {}],
      ['open', { who: 'ana' as QuintValue }],
    ]);
  });

  test('a trace drawn without --mbt is refused', () => {
    expect(() =>
      decodeItfTrace({ vars: ['state'], states: [{ state: 'closed' }] })
    ).toThrow('--mbt');
  });
});
