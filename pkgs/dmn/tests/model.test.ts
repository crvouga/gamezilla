import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDmn } from '@pkgs/dmn/model';

import { dmnTable, type TableSpec } from './fixtures/table';

const ACCESS = readFileSync(
  join(import.meta.dir, 'fixtures/access.dmn'),
  'utf8'
);

const TIER = {
  name: 'tier',
  typeRef: 'string',
  values: '"guest","free","plus"',
};
const PLAYS = { name: 'plays today', typeRef: 'number', values: '[0..1000]' };
const DECISION = {
  name: 'decision',
  typeRef: 'string',
  values: '"allow","deny"',
};

function issuesOf(spec: TableSpec): readonly string[] {
  const parsed = parseDmn(dmnTable(spec));
  return parsed.ok ? [] : parsed.issues;
}

describe('reading a DMN file', () => {
  test('the access table reads into inputs, outputs and rules', () => {
    const parsed = parseDmn(ACCESS);
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    const [decision] = parsed.definitions.decisions;
    expect(parsed.definitions.name).toBe('Access');
    expect(decision?.id).toBe('access');
    expect(decision?.hitPolicy).toBe('UNIQUE');
    expect(decision?.description).toStartWith('What a player may do');
    expect(decision?.inputs.map((i) => [i.name, i.typeRef, i.domain])).toEqual([
      ['tier', 'string', { kind: 'values', values: ['guest', 'free', 'plus'] }],
      [
        'capability',
        'string',
        {
          kind: 'values',
          values: ['game.play', 'game.save', 'game.customize'],
        },
      ],
      ['plays today', 'number', { kind: 'range', min: 0, max: 1000 }],
    ]);
    expect(decision?.outputs.map((o) => o.name)).toEqual([
      'decision',
      'reason',
    ]);
    expect(decision?.rules).toHaveLength(6);
    expect(decision?.rules[0]?.description).toBe(
      'Guests and free players play up to 20 games a day.'
    );
    expect(decision?.rules[1]?.inputEntries[2]).toEqual({
      kind: 'compare',
      op: '>=',
      value: 20,
    });
  });

  test('prefixed elements read the same as default-namespace ones', () => {
    const parsed = parseDmn(
      dmnTable({
        hitPolicy: 'FIRST',
        inputs: [TIER],
        outputs: [DECISION],
        rules: [{ id: 'r1', in: ['-'], out: ['"allow"'] }],
      })
    );
    expect(parsed.ok && parsed.definitions.decisions[0]?.hitPolicy).toBe(
      'FIRST'
    );
  });

  test('an open range bound excludes its end', () => {
    const parsed = parseDmn(
      dmnTable({
        inputs: [{ name: 'n', typeRef: 'number', values: '(0..10)' }],
        outputs: [DECISION],
        rules: [{ id: 'r1', in: ['-'], out: ['"allow"'] }],
      })
    );
    expect(
      parsed.ok && parsed.definitions.decisions[0]?.inputs[0]?.domain
    ).toEqual({
      kind: 'range',
      min: 1,
      max: 9,
    });
  });
});

describe('issues', () => {
  const base: TableSpec = {
    inputs: [TIER, PLAYS],
    outputs: [DECISION],
    rules: [{ id: 'r1', in: ['-', '-'], out: ['"allow"'] }],
  };

  const cases: readonly [string, TableSpec, string][] = [
    [
      'an input without its domain',
      { ...base, inputs: [{ name: 'tier', typeRef: 'string' }, PLAYS] },
      'input tier must declare its domain in <inputValues>',
    ],
    [
      'a rule with too few input entries',
      { ...base, rules: [{ id: 'r1', in: ['-'], out: ['"allow"'] }] },
      'rule r1 has 1 input entries for 2 inputs',
    ],
    [
      'a rule with too many output entries',
      {
        ...base,
        rules: [{ id: 'r1', in: ['-', '-'], out: ['"allow"', '"deny"'] }],
      },
      'rule r1 has 2 output entries for 1 outputs',
    ],
    [
      'an output outside its declared values',
      { ...base, rules: [{ id: 'r1', in: ['-', '-'], out: ['"maybe"'] }] },
      '"maybe" is outside the declared values ("allow", "deny")',
    ],
    [
      'unparseable FEEL',
      { ...base, rules: [{ id: 'r1', in: ['guest', '-'], out: ['"allow"'] }] },
      'rule r1, tier: FEEL "guest": expected a value',
    ],
    [
      'a literal outside the input domain (a typo)',
      { ...base, rules: [{ id: 'r1', in: ['"plsu"', '-'], out: ['"allow"'] }] },
      '"plsu" is outside the declared values ("guest", "free", "plus")',
    ],
    [
      'a string compared by order',
      { ...base, rules: [{ id: 'r1', in: ['< 3', '-'], out: ['"allow"'] }] },
      'compares by order, but tier is a string',
    ],
    [
      'a duplicate id',
      {
        ...base,
        rules: [...base.rules, { id: 'r1', in: ['-', '-'], out: ['"deny"'] }],
      },
      'id "r1" is used twice',
    ],
    [
      'an unknown hit policy',
      { ...base, hitPolicy: 'COLLECT' },
      'hit policy COLLECT is not supported',
    ],
    [
      'an unknown type',
      { ...base, inputs: [TIER, { name: 'n', typeRef: 'date', values: '1' }] },
      'typeRef must be string, number or boolean (got date)',
    ],
    [
      'a range that is not whole numbers',
      {
        ...base,
        inputs: [TIER, { name: 'n', typeRef: 'number', values: '[0..1.5]' }],
      },
      'a range domain is whole numbers',
    ],
    [
      'an unbounded domain',
      {
        ...base,
        inputs: [TIER, { name: 'n', typeRef: 'number', values: '>= 0' }],
      },
      'list literals ("a","b") or give a range',
    ],
    [
      'a domain value of the wrong type',
      {
        ...base,
        inputs: [{ name: 'tier', typeRef: 'string', values: '"a", 1' }, PLAYS],
      },
      'domain value 1 is not a string',
    ],
    [
      'two columns with one name',
      { ...base, inputs: [TIER, { ...TIER }] },
      '"tier" names two columns',
    ],
    [
      'PRIORITY without ranked outputs',
      {
        ...base,
        hitPolicy: 'PRIORITY',
        outputs: [{ name: 'decision', typeRef: 'string' }],
      },
      'PRIORITY needs outputValues on output decision',
    ],
  ];
  for (const [what, spec, message] of cases) {
    test(what, () => {
      const issues = issuesOf(spec);
      expect(issues.join('\n')).toContain(message);
    });
  }

  test('an issue names the line and column of the element', () => {
    const issues = issuesOf({
      ...base,
      rules: [{ id: 'r1', in: ['"plsu"', '-'], out: ['"allow"'] }],
    });
    expect(issues[0]).toMatch(/^\d+:\d+: decision table: rule r1, tier: /);
  });

  test('XML errors, a missing table and an empty file are issues too', () => {
    expect(parseDmn('<definitions>').ok).toBe(false);
    const noTable = parseDmn('<definitions><decision id="d"/></definitions>');
    expect(!noTable.ok && noTable.issues[0]).toContain(
      'decision d: needs exactly one <decisionTable>'
    );
    const none = parseDmn('<definitions/>');
    expect(!none.ok && none.issues[0]).toContain(
      'the file defines no decision'
    );
    const chained = parseDmn(
      '<definitions><decision id="d"><informationRequirement><requiredDecision href="#e"/></informationRequirement></decision></definitions>'
    );
    expect(!chained.ok && chained.issues[0]).toContain(
      'decisions that require other decisions are not supported'
    );
  });
});
