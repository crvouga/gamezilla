import { describe, expect, test } from 'bun:test';
import type {
  Chart,
  MachineConfig,
  SpecBundle,
  StateConfig,
} from '@crvouga/atlas';
import { analyzeStatecharts } from './statechart-analysis';

function state(description: string, extra: StateConfig = {}): StateConfig {
  return { meta: { description, source: ['specs/example.feature'] }, ...extra };
}

function chart(machine: MachineConfig): Chart {
  return { file: `${machine.id}.machine.yaml`, format: 'xstate', machine };
}

function example(): SpecBundle {
  return {
    directory: 'fixtures',
    root: 'example',
    charts: [
      chart({
        id: 'example',
        initial: 'Lobby',
        meta: {
          description: 'Example flow',
          source: ['specs/example.feature'],
        },
        states: {
          Lobby: state('Choose a board', {
            meta: {
              description: 'Choose a board',
              route: '/',
              source: ['specs/example.feature'],
            },
            on: { Start: '#Board' },
          }),
          Board: state('Play the board', { on: { Win: '#Won' } }),
          Won: state('Keep the result', { on: { Restart: '#Lobby' } }),
        },
      }),
    ],
    journeys: [
      {
        name: 'A win',
        description: 'Reach the lasting result',
        events: ['Start', 'Win'],
        endsIn: ['Won'],
      },
    ],
  };
}

function rules(bundle: SpecBundle) {
  return analyzeStatecharts(bundle).issues.map((issue) => issue.rule);
}

describe('statechart structural analysis', () => {
  test('plans every transition from the canonical beginning and preserves SCXML replay', () => {
    const result = analyzeStatecharts(example());
    expect(result.issues).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.configurations).toBe(3);
    expect(result.coverage).toEqual({
      reachableStates: 3,
      reachableTransitions: 3,
      plannedTransitions: 3,
    });
    expect(
      result.transitions.find((edge) => edge.event === 'Restart')?.shortestPath
    ).toEqual(['Start', 'Win', 'Restart']);
    expect(
      result.paths.every(
        (path) => path.start.length === 1 && path.start[0] === 'Lobby'
      )
    ).toBe(true);
    expect(result.journeys[0]?.valid).toBe(true);
    expect(result.routePaths['/']).toEqual([]);
  });

  test('a truncated exploration never reports a complete product', () => {
    // regression: statechart-exploration-cap-false-complete
    const result = analyzeStatecharts(example(), { maxConfigurations: 2 });
    expect(result.complete).toBe(false);
    expect(result.configurations).toBe(2);
    expect(result.issues.some((issue) => issue.rule === 'budget')).toBe(true);
  });

  test('requires a positive finite configuration budget', () => {
    for (const maxConfigurations of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      const result = analyzeStatecharts(example(), { maxConfigurations });
      expect(result.complete).toBe(false);
      expect(
        result.issues.some((issue) =>
          issue.message.includes('positive safe integer')
        )
      ).toBe(true);
    }
  });

  test('fails unknown events and wrong journey endpoints', () => {
    const bundle = example();
    bundle.journeys.push(
      {
        name: 'Unknown',
        description: 'Unsupported choice',
        events: ['Typo'],
        endsIn: ['Lobby'],
      },
      {
        name: 'Wrong result',
        description: 'Wrong expectation',
        events: ['Start'],
        endsIn: ['Won'],
      }
    );
    const result = analyzeStatecharts(bundle);
    expect(
      result.journeys
        .filter((journey) => !journey.valid)
        .map((journey) => journey.name)
    ).toEqual(['Unknown', 'Wrong result']);
    expect(
      result.issues.filter((issue) => issue.rule === 'journey')
    ).toHaveLength(2);
  });

  test('rejects isolated roots and duplicate journey names', () => {
    const bundle = example();
    bundle.charts.push(
      chart({
        id: 'orphan',
        initial: 'Alone',
        states: {
          Alone: state('Outside', {
            meta: { description: 'Outside', deadEnd: 'End' },
          }),
        },
      })
    );
    bundle.journeys.push({ ...bundle.journeys[0]! });
    expect(rules(bundle)).toContain('root');
    expect(rules(bundle)).toContain('unique');
  });

  test('rejects global name and id collisions before Atlas can overwrite them', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Host'] = state('Host', {
      invoke: { src: 'child' },
    });
    bundle.charts.push(
      chart({
        id: 'child',
        initial: 'Lobby',
        states: { Lobby: state('Duplicate') },
      })
    );
    const result = analyzeStatecharts(bundle);
    expect(result.machine).toBeNull();
    expect(result.issues.some((issue) => issue.rule === 'unique')).toBe(true);
  });

  test('rejects custom ids that Atlas cannot resolve as unique state names', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Board']!.id = 'Different id';
    expect(rules(bundle)).toContain('identity');
  });

  test('rejects charts invoked twice and multiple invokes in one state', () => {
    const bundle = example();
    const host = bundle.charts[0]!.machine.states!['Lobby']!;
    host.invoke = [{ src: 'child' }, { src: 'child' }];
    bundle.charts.push(
      chart({
        id: 'child',
        initial: 'Child',
        states: { Child: state('Inner') },
      })
    );
    const result = analyzeStatecharts(bundle);
    expect(result.machine).toBeNull();
    expect(
      result.issues.filter((issue) => issue.rule === 'composition').length
    ).toBeGreaterThan(1);
  });

  test('rejects guards before evaluating chart logic', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Board']!['always'] = '#Won';
    const result = analyzeStatecharts(bundle);
    expect(result.machine).toBeNull();
    expect(result.issues.some((issue) => issue.rule === 'pure')).toBe(true);
  });

  test('finds unreachable states and uncovered transitions', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Hidden'] = state('Unreachable', {
      on: { Escape: '#Lobby' },
    });
    const result = analyzeStatecharts(bundle);
    expect(result.issues.some((issue) => issue.rule === 'reachable')).toBe(
      true
    );
    expect(result.issues.some((issue) => issue.rule === 'transition')).toBe(
      true
    );
  });

  test('requires source files and existing referenced line numbers', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Board']!.meta!.source = [
      'specs/example.feature:40',
    ];
    const sourceFiles = new Map([
      ['specs/example.feature', 'Feature: Example\nScenario: Example\n'],
    ]);
    const result = analyzeStatecharts(bundle, { sourceFiles });
    expect(
      result.issues.filter((issue) => issue.rule === 'source')
    ).toHaveLength(1);
    expect(result.issues[0]?.message).toContain('has no such line');
    expect(
      analyzeStatecharts(example(), { sourceFiles: new Map() }).issues.filter(
        (issue) => issue.rule === 'source'
      )
    ).toHaveLength(4);
  });

  test('SCXML token collisions cannot silently change the explored product', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Won!'] = state('Different punctuation', {
      on: { Back: '#Lobby' },
    });
    bundle.charts[0]!.machine.states!['Lobby']!.on!['Alternate'] = '#Won!';
    expect(rules(bundle)).toContain('scxml');
  });

  test('settles child final hand-offs automatically and covers their transition', () => {
    const bundle: SpecBundle = {
      directory: 'fixtures',
      root: 'parent',
      charts: [
        chart({
          id: 'parent',
          initial: 'Host',
          states: {
            Host: state('Child activity', {
              invoke: { src: 'activity', id: 'activity', onDone: '#Finished' },
            }),
            Finished: state('Done', { on: { Again: '#Host' } }),
          },
        }),
        chart({
          id: 'activity',
          initial: 'Working',
          states: {
            Working: state('Working', { on: { Complete: '#Child result' } }),
            'Child result': state('Complete', { type: 'final' }),
          },
        }),
      ],
      journeys: [
        {
          name: 'Completion',
          description: 'Finish the child activity',
          events: ['Complete'],
          endsIn: ['Finished'],
        },
      ],
    };
    const result = analyzeStatecharts(bundle);
    expect(result.issues).toEqual([]);
    expect(
      result.paths[0]?.steps.map((step) => [step.event, step.handOff])
    ).toEqual([
      ['Complete', false],
      ['done.invoke.activity', true],
    ]);
    expect(result.coverage.reachableStates).toBe(4);
    expect(result.coverage.plannedTransitions).toBe(3);
  });

  test('automatic hand-off cycles fail without an infinite replay', () => {
    const bundle: SpecBundle = {
      directory: 'fixtures',
      root: 'parent',
      journeys: [],
      charts: [
        chart({
          id: 'parent',
          initial: 'Host',
          states: {
            Host: state('Activity', {
              invoke: { src: 'activity', onDone: '#Host' },
            }),
          },
        }),
        chart({
          id: 'activity',
          initial: 'Loop',
          states: { Loop: state('Immediately complete', { type: 'final' }) },
        }),
      ],
    };
    const result = analyzeStatecharts(bundle);
    expect(result.complete).toBe(false);
    expect(result.issues.some((issue) => issue.rule === 'automatic')).toBe(
      true
    );
  });

  test('verifications guest and deleted identities against paid access across parallel regions', () => {
    const bundle: SpecBundle = {
      directory: 'fixtures',
      root: 'parallel',
      journeys: [],
      charts: [
        chart({
          id: 'parallel',
          initial: 'Whole',
          states: {
            Whole: state('Independent regions', {
              type: 'parallel',
              states: {
                Person: state('Identity', {
                  initial: 'Guest',
                  states: {
                    Guest: state('Guest', { on: { Delete: '#Deleted' } }),
                    Deleted: state('Deleted', { on: { Return: '#Guest' } }),
                  },
                }),
                Access: state('Access', {
                  initial: 'Free',
                  states: {
                    Free: state('Free', { on: { Upgrade: '#Paid' } }),
                    Paid: state('Paid', { on: { Downgrade: '#Free' } }),
                  },
                }),
              },
            }),
          },
        }),
      ],
    };
    const result = analyzeStatecharts(bundle, {
      identity: { guest: ['Guest'], deleted: ['Deleted'], paid: ['Paid'] },
    });
    expect(result.complete).toBe(true);
    expect(
      result.issues.some(
        (issue) =>
          issue.rule === 'identity' && issue.message.includes('Upgrade')
      )
    ).toBe(true);
  });

  test('lists singular and grouped routes with the shortest path to shared destinations', () => {
    const bundle = example();
    bundle.charts[0]!.machine.states!['Lobby']!.meta!['routes'] = [
      '/start',
      '/lobby',
    ];
    bundle.charts[0]!.machine.states!['Board']!.meta!['routes'] = [
      '/play',
      '/shared',
    ];
    bundle.charts[0]!.machine.states!['Won']!.meta!['routes'] = [
      '/result',
      '/shared',
    ];
    expect(analyzeStatecharts(bundle).routePaths).toEqual({
      '/': [],
      '/start': [],
      '/lobby': [],
      '/play': ['Start'],
      '/result': ['Start', 'Win'],
      '/shared': ['Start'],
    });
  });
});
