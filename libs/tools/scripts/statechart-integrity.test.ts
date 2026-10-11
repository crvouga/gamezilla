import { describe, expect, test } from 'bun:test';
import { bundleOf, type MachineConfig, type StateConfig } from '@crvouga/atlas';
import { analyzeStatecharts } from './statechart-analysis';
import type { ProductContract } from './statechart-contracts';
import { productGuide } from './statechart-guide';
import { guideIntegrityProblems } from './statechart-integrity';

function state(extra: StateConfig = {}): StateConfig {
  return { meta: { description: 'Structural fixture state' }, ...extra };
}

function fixture() {
  const root: MachineConfig = {
    id: 'product',
    initial: 'Shell',
    meta: { eventKinds: { OpenAlpha: 'user', OpenBeta: 'user' } },
    states: {
      Shell: state({
        initial: 'Start',
        on: { OpenAlpha: '#Alpha host', OpenBeta: '#Beta host' },
        states: {
          Start: state(),
          'Alpha host': state({ invoke: { src: 'alpha' } }),
          'Beta host': state({ invoke: { src: 'beta' } }),
        },
      }),
    },
  };
  const alpha: MachineConfig = {
    id: 'alpha',
    initial: 'Alpha leaf',
    meta: {
      description: 'Alpha activity',
      source: ['specs/alpha.feature'],
      eventKinds: { Move: 'user' },
    },
    states: { 'Alpha leaf': state({ on: { Move: '#Alpha leaf' } }) },
  };
  const beta: MachineConfig = {
    id: 'beta',
    initial: 'Beta leaf',
    meta: {
      description: 'Beta activity',
      source: ['specs/beta.feature'],
      eventKinds: { Inspect: 'system' },
    },
    states: { 'Beta leaf': state({ on: { Inspect: '#Beta leaf' } }) },
  };
  const bundle = bundleOf(
    'fixtures',
    [root, alpha, beta].map((machine) => ({
      file: `${machine.id}.machine.json`,
      format: 'xstate' as const,
      machine,
    })),
    [
      {
        name: 'Explore everything',
        description: 'Every module in one route',
        events: ['OpenAlpha', 'Move', 'OpenBeta', 'Inspect'],
        endsIn: ['Beta leaf'],
      },
    ]
  );
  const contracts = fixtureContracts();
  return {
    bundle,
    contracts,
    guide: structuredClone(productGuide(bundle, contracts)),
  };
}

function fixtureContracts(): ProductContract[] {
  return [
    {
      id: 'alpha-rule',
      name: 'Alpha rule',
      source: 'specs/alpha.feature',
      steps: [
        {
          keyword: 'Then',
          text: 'Keep the chosen value',
          table: [
            ['name', 'value'],
            ['one', '<&>'],
          ],
          docString: '  exact\ntext & <tags>\n',
        },
      ],
    },
    {
      id: 'beta-rule',
      name: 'Beta rule',
      source: 'specs/beta.feature',
      steps: [{ keyword: 'Then', text: 'Keep the inspected value' }],
    },
    {
      id: 'gap-note',
      name: 'Unresolved scope',
      source: 'docs/gaps.md',
      steps: [
        {
          keyword: 'Read',
          text: 'Open decisions',
          docString: '# Contract gaps\nNo invented behavior.',
        },
      ],
    },
  ];
}

function problems(input = fixture()) {
  return guideIntegrityProblems(input.bundle, input.guide, {
    contracts: input.contracts,
    tour: 'Explore everything',
    gapSources: ['docs/gaps.md'],
  });
}

describe('portable statechart guide integrity', () => {
  test('preserves one graph, every journey, complete rule cards and visible scope notes', () => {
    expect(problems()).toEqual([]);
  });

  test('rejects a changed graph even when a tour still reaches its destination', () => {
    const input = fixture();
    input.guide.states!['Shell']!.states!['Alpha host']!.states!['Alpha leaf']!
      .on!['Move'] = '#Beta leaf';
    expect(problems(input).some((issue) => issue.rule === 'guide-graph')).toBe(
      true
    );
  });

  test('requires all catalogue cards and their exact owning-capability copies', () => {
    const input = fixture();
    input.guide.meta!['contracts'] = input.contracts.slice(1);
    const hostContracts = input.guide.states!['Shell']!.states!['Alpha host']!
      .meta!['contracts'] as typeof input.contracts;
    hostContracts[0]!.steps[0]!.docString = 'Shortened text';
    const result = problems(input);
    expect(result.filter((issue) => issue.rule === 'contract')).toHaveLength(2);
  });

  test('rejects duplicate rule ids and an absent contract-gap document', () => {
    const input = fixture();
    input.contracts.push({ ...input.contracts[0]! });
    expect(
      problems(input).some((issue) =>
        issue.message.includes('Duplicate rule card')
      )
    ).toBe(true);
    expect(
      guideIntegrityProblems(input.bundle, input.guide, {
        contracts: input.contracts,
        tour: 'Explore everything',
        gapSources: ['docs/unknown-gap.md'],
      }).some((issue) => issue.rule === 'gap')
    ).toBe(true);
  });

  test('requires every used event to have a valid explicit kind', () => {
    const input = fixture();
    input.guide.meta!['eventKinds'] = {
      OpenAlpha: 'user',
      OpenBeta: 'whatever',
      Move: 'user',
    };
    expect(
      problems(input).filter((issue) => issue.rule === 'event-kind').length
    ).toBeGreaterThan(1);
  });

  test('does not coerce an array into a valid event classification', () => {
    // regression: statechart-guide-event-kind-coercion
    const input = fixture();
    const kinds = input.guide.meta!['eventKinds'] as Record<string, unknown>;
    kinds['Inspect'] = ['system'];
    expect(problems(input).some((issue) => issue.rule === 'event-kind')).toBe(
      true
    );
  });

  test('rejects unsupported compiled actions before any graph execution', () => {
    // regression: statechart-guide-unsupported-action
    const input = fixture();
    input.guide.states!['Shell']!.states!['Start']!['entry'] =
      'external-action';
    expect(
      problems(input).some(
        (issue) =>
          issue.rule === 'guide-pure' && issue.message.includes('entry')
      )
    ).toBe(true);
  });

  test('preserves authored state explanations and source references after enrichment', () => {
    // regression: statechart-guide-authored-metadata-drift
    const input = fixture();
    input.bundle.charts[1]!.machine.states!['Alpha leaf']!.meta!.source = [
      'specs/alpha.feature:2',
    ];
    input.guide = structuredClone(productGuide(input.bundle, input.contracts));
    const leaf =
      input.guide.states!['Shell']!.states!['Alpha host']!.states![
        'Alpha leaf'
      ]!;
    leaf.meta!.description = 'Completely different product behavior';
    leaf.meta!.source = [];
    expect(
      problems(input).some((issue) => issue.rule === 'guide-metadata')
    ).toBe(true);
  });

  test('rejects classification disagreements hidden by root fallback', () => {
    const input = fixture();
    input.bundle.charts[0]!.machine.meta!['eventKinds'] = {
      OpenAlpha: 'user',
      OpenBeta: 'user',
      Inspect: 'user',
    };
    expect(
      problems(input).some(
        (issue) =>
          issue.rule === 'event-kind' && issue.message.includes('disagrees')
      )
    ).toBe(true);
  });

  test('requires one continuous whole-product tour to enter every invoked module', () => {
    const input = fixture();
    input.bundle.journeys[0]!.events = ['OpenAlpha', 'Move'];
    input.bundle.journeys[0]!.endsIn = ['Alpha leaf'];
    expect(
      problems(input).some(
        (issue) => issue.rule === 'tour' && issue.message.includes('beta')
      )
    ).toBe(true);
    input.bundle.journeys = [];
    expect(problems(input).some((issue) => issue.rule === 'tour')).toBe(true);
  });

  test('SCXML cannot silently strip information from guide metadata', () => {
    // regression: statechart-scxml-metadata-unchecked
    const input = fixture();
    input.guide.states!['Shell']!.states!['Alpha host']!.meta!.description =
      ' Keep this exact description ';
    expect(
      problems(input).some(
        (issue) => issue.rule === 'scxml' && issue.message.includes('metadata')
      )
    ).toBe(true);
  });

  test('a compiled chart cannot lose automatic child completion semantics', () => {
    // regression: statechart-compiled-guide-handoff
    const input = fixture();
    const alpha = input.bundle.charts[1]!.machine;
    alpha.states!['Alpha leaf']!.on = { Move: '#Complete' };
    alpha.states!['Complete'] = state({ type: 'final' });
    const host =
      input.bundle.charts[0]!.machine.states!['Shell']!.states!['Alpha host']!;
    host.invoke = { src: 'alpha', onDone: '#Beta host' };
    input.bundle.journeys[0]!.events = ['OpenAlpha', 'Move', 'Inspect'];
    input.guide = productGuide(input.bundle, input.contracts);
    expect(problems(input).some((issue) => issue.rule === 'guide-replay')).toBe(
      true
    );
  });

  test('checks generated paths that reach automatic completion outside every curated journey', () => {
    // regression: statechart-compiled-guide-handoff
    const input = fixture();
    const alpha = input.bundle.charts[1]!.machine;
    alpha.states!['Alpha leaf']!.on!['Finish'] = '#Complete';
    alpha.states!['Complete'] = state({ type: 'final' });
    input.bundle.charts[0]!.machine.states!['Shell']!.states![
      'Alpha host'
    ]!.invoke = { src: 'alpha', onDone: '#Beta host' };
    const paths = analyzeStatecharts(input.bundle).paths;
    input.guide = productGuide(input.bundle, input.contracts);
    const result = guideIntegrityProblems(input.bundle, input.guide, {
      contracts: input.contracts,
      tour: 'Explore everything',
      paths,
    });
    expect(
      result.some(
        (issue) =>
          issue.rule === 'guide-replay' && issue.message.includes('Finish')
      )
    ).toBe(true);
    expect(result.some((issue) => issue.rule === 'guide-handoff')).toBe(true);
  });
});
