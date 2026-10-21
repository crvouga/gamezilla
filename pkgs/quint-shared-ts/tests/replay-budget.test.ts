import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { ItfTrace } from '@pkgs/quint-shared-ts/itf';
import { replaySelection } from '@pkgs/quint-shared-ts/replay-budget';
import {
  DEFAULT_REPLAY_TRACES,
  quintReplayBudget,
} from '@pkgs/quint-shared-ts/wall';
import fc from 'fast-check';

/** A trace that takes `actions` in order, after `init`. */
function trace(...actions: string[]): ItfTrace {
  return {
    vars: [],
    states: ['init', ...actions].map((action) => ({
      action,
      picks: {},
      vars: {},
    })),
  };
}

const BOUND = ['init', 'open', 'close', 'lock', 'unlock'];

describe('replay selection', () => {
  test('an exploring run replays every drawn trace', () => {
    const traces = [trace('open'), trace('open', 'close'), trace('lock')];
    expect([
      ...replaySelection(traces, BOUND, Number.POSITIVE_INFINITY),
    ]).toEqual([0, 1, 2]);
  });

  test('a budget keeps the traces that take every bound action, then the earliest drawn', () => {
    const traces = [
      trace('open'),
      trace('open', 'close'),
      trace('open', 'close', 'open'),
      trace('lock', 'unlock'),
      trace('open', 'close', 'lock', 'unlock'),
      trace('close'),
    ];
    // Trace 4 alone takes every action; the budget then fills from the front.
    expect([...replaySelection(traces, BOUND, 1)]).toEqual([4]);
    expect([...replaySelection(traces, BOUND, 3)].sort()).toEqual([0, 1, 4]);
    expect(replaySelection(traces, BOUND, 64).size).toBe(6);
  });

  test('a cover larger than the budget is replayed whole', () => {
    const traces = [
      trace('open'),
      trace('close'),
      trace('lock'),
      trace('unlock'),
      trace('open'),
    ];
    expect([...replaySelection(traces, BOUND, 1)].sort()).toEqual([0, 1, 2, 3]);
  });

  test('between traces that add the same coverage the shorter is chosen, then the earlier', () => {
    const traces = [
      trace('open', 'open', 'close'),
      trace('open', 'close'),
      trace('close', 'open'),
    ];
    expect([...replaySelection(traces, ['init', 'open', 'close'], 1)]).toEqual([
      1,
    ]);
  });

  test('an action outside the binding earns a trace no place in the cover', () => {
    const traces = [trace('open'), trace('_unbound', '_other', 'open')];
    expect([...replaySelection(traces, ['init', 'open'], 1)]).toEqual([0]);
  });

  test('a budget that is not a whole number of traces is refused', () => {
    for (const budget of [0, -1, 1.5, Number.NaN])
      expect(() => replaySelection([trace('open')], BOUND, budget)).toThrow(
        'whole number of traces'
      );
  });

  test('every selection covers what the whole draw covers and is no larger than it must be', () => {
    const action = fc.constantFrom('open', 'close', 'lock', 'unlock', 'knock');
    assertProperty(
      'replay-budget-cover',
      fc.property(
        fc.array(fc.array(action, { maxLength: 6 }), {
          minLength: 1,
          maxLength: 40,
        }),
        fc.integer({ min: 1, max: 48 }),
        (draws, budget) => {
          const traces = draws.map((actions) => trace(...actions));
          const bound = [...BOUND, 'knock'];
          const selected = replaySelection(traces, bound, budget);
          const taken = (indexes: Iterable<number>) =>
            new Set(
              [...indexes].flatMap((index) =>
                traces[index]!.states.map((state) => state.action)
              )
            );
          expect(taken(selected)).toEqual(taken(traces.keys()));
          // The cover is the only reason to exceed the budget.
          const cover = replaySelection(traces, bound, 1);
          expect(selected.size).toBe(
            Math.min(traces.length, Math.max(budget, cover.size))
          );
          for (const index of cover) expect(selected.has(index)).toBe(true);
          expect(selected).toEqual(replaySelection(traces, bound, budget));
        }
      )
    );
  });
});

describe("the run's replay budget", () => {
  function budgetWith(value: string | undefined): number {
    const before = process.env['QUINT_REPLAY_TRACES'];
    if (value === undefined) delete process.env['QUINT_REPLAY_TRACES'];
    else process.env['QUINT_REPLAY_TRACES'] = value;
    try {
      return quintReplayBudget();
    } finally {
      if (before === undefined) delete process.env['QUINT_REPLAY_TRACES'];
      else process.env['QUINT_REPLAY_TRACES'] = before;
    }
  }

  test('a run that names no budget replays the smallest bounded selection', () => {
    expect(DEFAULT_REPLAY_TRACES).toBe(1);
    for (const unset of [undefined, '', '  '])
      expect(budgetWith(unset)).toBe(DEFAULT_REPLAY_TRACES);
  });

  test('exploring is asked for by name, and a number is a number of traces', () => {
    expect(budgetWith('all')).toBe(Number.POSITIVE_INFINITY);
    expect(budgetWith('8')).toBe(8);
    for (const bad of ['0', '-2', '1.5', 'every', 'ALL'])
      expect(() => budgetWith(bad)).toThrow('neither "all" nor a whole number');
  });
});
