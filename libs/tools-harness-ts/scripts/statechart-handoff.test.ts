import { expect, test } from 'bun:test';
import type { SpecBundle, StateConfig } from '@crvouga/atlas';
import { analyzeStatecharts } from './statechart-analysis';

function state(extra: StateConfig = {}): StateConfig {
  return { meta: { description: 'Structural fixture state' }, ...extra };
}

test('identity invariants include transient states before automatic completion', () => {
  // regression: statechart-transient-paid-identity
  const bundle: SpecBundle = {
    directory: 'fixtures',
    root: 'parallel',
    journeys: [],
    charts: [
      {
        file: 'parallel.machine.yaml',
        format: 'xstate',
        machine: {
          id: 'parallel',
          initial: 'Whole',
          states: {
            Whole: state({
              type: 'parallel',
              states: {
                Person: state({
                  initial: 'Host',
                  states: {
                    Host: state({
                      invoke: { src: 'activity', onDone: '#Account' },
                    }),
                    Account: state({ on: { Reset: '#Host' } }),
                  },
                }),
                Access: state({
                  initial: 'Paid',
                  states: {
                    Paid: state({ on: { Retain: '#Paid' } }),
                  },
                }),
              },
            }),
          },
        },
      },
      {
        file: 'activity.machine.yaml',
        format: 'xstate',
        machine: {
          id: 'activity',
          initial: 'Guest',
          states: {
            Guest: state({ type: 'final' }),
          },
        },
      },
    ],
  };
  const result = analyzeStatecharts(bundle, {
    identity: { guest: ['Guest'], deleted: [], paid: ['Paid'] },
  });
  expect(result.complete).toBe(true);
  expect(result.issues.some((issue) => issue.rule === 'identity')).toBe(true);
});
