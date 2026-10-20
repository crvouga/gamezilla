import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundleOf, type MachineConfig, walkStates } from '@crvouga/atlas';
import { type StateNodeConfig, StateNodeSchema } from '@crvouga/atlas/schema';
import { productContracts, sourcePath } from './statechart-contracts';
import { productGuide, unmappedContracts } from './statechart-guide';
import { languageContracts } from './statechart-language';

const FEATURE = `Feature: A shared list
  Background:
    Given a list exists
  Scenario Outline: Keep the chosen value
    Given the value is <value>
    When the person saves it
    Then the saved value is <value>
    Examples:
      | value |
      | first |
      | second |
  Scenario: Explain a question
    When the person asks
      """
      keep all this text
      """
    Then the answer has entries
      | name | value |
      | one | two |
`;

describe('source-derived statechart guide', () => {
  // regression: puzzle-contract-statechart-ownership
  // regression: puzzle-opponent-statechart-ownership
  test('the puzzle guide owns imported sources and opponent-only contracts', () => {
    const root = join(import.meta.dir, '../../..');
    const paths = [
      'specs/chess/puzzle-load-controls.feature',
      'specs/chess/puzzle-load-progress.feature',
      'specs/chess/puzzle-load-updates.feature',
      'specs/chess/puzzle-source.qnt',
      'specs/chess/saved-puzzles.feature',
      'specs/games/puzzle-opponent.feature',
    ];
    const machine = JSON.parse(
      readFileSync(join(root, 'specs/product.machine.json'), 'utf8')
    ) as MachineConfig;
    const bundle = bundleOf(
      'specs',
      [{ file: 'product.machine.json', format: 'xstate', machine }],
      []
    );
    const contracts = productContracts(
      new Map(
        paths.map((path) => [path, readFileSync(join(root, path), 'utf8')])
      )
    );
    const guide = productGuide(bundle, contracts);
    expect(guide.meta?.['contracts']).toEqual(contracts);
    expect(unmappedContracts(bundle, contracts)).toEqual([]);
  });
  // regression: atlas-schema-strict-optional
  test('the public schema represents its explicit undefined optional fields', () => {
    const node: StateNodeConfig = StateNodeSchema.parse({
      id: undefined,
      initial: undefined,
      type: undefined,
      meta: undefined,
      on: undefined,
      states: { Board: { id: undefined } },
    });
    expect(Object.hasOwn(node, 'id')).toBe(true);
    expect(node.states?.['Board']?.id).toBeUndefined();
    expect(() =>
      StateNodeSchema.parse({ meta: { hints: ['Valid', 12] } })
    ).toThrow();
  });

  test('includes the canonical definition when another capability borrows a term', () => {
    const sources = new Map([
      [
        'specs/ubiquitous-language.yml',
        'context: Shared language\npurpose: Shared facts\nterms:\n  - term: person\n    definition: Someone using the product\n    published: true\n',
      ],
      [
        'specs/example/ubiquitous-language.yml',
        'context: Lists\npurpose: Keep shared lists\nterms:\n  - term: person\n    from: kernel\n',
      ],
    ]);
    const contracts = languageContracts(sources);
    expect(contracts).toHaveLength(2);
    expect(
      contracts.find(
        (contract) =>
          contract.source === 'specs/example/ubiquitous-language.yml'
      )?.steps
    ).toEqual([
      { keyword: 'Meaning', text: 'Someone using the product' },
      { keyword: 'From', text: 'Shared language' },
    ]);
    sources.delete('specs/ubiquitous-language.yml');
    expect(() => languageContracts(sources)).toThrow('missing definition');
  });
  test('expands every Outline row with Background and complete source data', () => {
    const catalog = productContracts(
      new Map([['specs/example/list.feature', FEATURE]])
    );
    const contracts = catalog.filter((card) => card.id.includes(':'));
    expect(contracts).toHaveLength(3);
    expect(new Set(contracts.map((contract) => contract.id)).size).toBe(3);
    expect(contracts[0]?.steps.map((step) => step.text)).toEqual([
      'a list exists',
      'the value is first',
      'the person saves it',
      'the saved value is first',
    ]);
    expect(contracts[1]?.steps.at(-1)?.text).toBe('the saved value is second');
    expect(contracts[2]?.steps[1]?.docString).toBe('keep all this text');
    expect(contracts[2]?.steps[2]?.table).toEqual([
      ['name', 'value'],
      ['one', 'two'],
    ]);
  });

  // regression: statechart-rule-prose-omission
  test('retains Rule headings and prose that example expansion cannot express', () => {
    const feature = `Feature: Accepted waits keep their outcomes
  Rule: Waiting has no time limit
    No counter-example: time alone never ends a wait.
    Scenario: A person still waits after a day
      Given Alice is waiting
      When a day passes
      Then Alice is still waiting
`;
    const cards = productContracts(
      new Map([['specs/matchmaking/lasting-outcomes.feature', feature]])
    );
    expect(cards).toHaveLength(2);
    expect(cards[0]?.steps[0]?.docString).toBe(feature);
    expect(cards[0]?.steps[0]?.docString).toContain(
      'Waiting has no time limit'
    );
    expect(cards[0]?.steps[0]?.docString).toContain('No counter-example');
    expect(cards[1]?.steps.at(-1)?.text).toBe('Alice is still waiting');
  });

  test('does not swallow malformed authoritative features or decisions', () => {
    expect(() =>
      productContracts(
        new Map([['specs/example/broken.feature', 'Scenario: misplaced']])
      )
    ).toThrow();
    expect(() =>
      productContracts(
        new Map([['specs/example/broken.dmn', '<definitions/>']])
      )
    ).toThrow();
  });

  test('retains formal models verbatim and resolves source addresses', () => {
    const text =
      '// Permanent outcomes\nmodule outcomes { val immutable = true }';
    const contracts = productContracts(
      new Map([['specs/example/outcomes.qnt', text]])
    );
    expect(contracts[0]?.steps[0]?.docString).toBe(text);
    expect(sourcePath('specs/example/list.feature:13')).toBe(
      'specs/example/list.feature'
    );
    expect(sourcePath('specs/README.md#context-map')).toBe('specs/README.md');
    expect(sourcePath('specs/example/access.dmn#access/guest')).toBe(
      'specs/example/access.dmn'
    );
  });

  test('inlines all capabilities and keeps rules at their owning boundary', () => {
    const root: MachineConfig = {
      id: 'product',
      initial: 'Home',
      states: {
        Home: {
          id: 'Home',
          meta: { description: 'Home' },
          invoke: { src: 'list' },
        },
      },
    };
    const child: MachineConfig = {
      id: 'list',
      initial: 'Saved',
      meta: {
        description: 'Keep a shared list',
        source: ['specs/example/list.feature'],
      },
      states: {
        Saved: {
          id: 'Saved',
          meta: {
            description: 'Saved',
            checks: ['A title is not a screen assertion'],
          },
        },
      },
    };
    const bundle = bundleOf(
      '',
      [
        { file: 'product.machine.json', format: 'xstate', machine: root },
        { file: 'list.machine.json', format: 'xstate', machine: child },
      ],
      []
    );
    const contracts = productContracts(
      new Map([['specs/example/list.feature', FEATURE]])
    );
    const guide = productGuide(bundle, contracts);
    expect(unmappedContracts(bundle, contracts)).toEqual([]);
    expect(walkStates(guide).every(({ node }) => !node.invoke)).toBe(true);
    expect(guide.states?.['Home']?.meta?.['contracts']).toEqual(contracts);
    expect(
      guide.states?.['Home']?.states?.['Saved']?.meta?.checks
    ).toBeUndefined();
    expect(child.states?.['Saved']?.meta?.checks).toEqual([
      'A title is not a screen assertion',
    ]);
    expect(
      unmappedContracts(bundle, [
        ...contracts,
        {
          id: 'missing',
          name: 'Missing',
          source: 'specs/example/new.feature',
          steps: [],
        },
      ])
    ).toEqual(['specs/example/new.feature']);
  });
});
