import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandResult } from '@pkgs/alloy-shared/receipt';
import {
  commandVerdict,
  parseAlloyType,
  parseReceipt,
  solutionSummary,
} from '@pkgs/alloy-shared/receipt';
import { modelSigs, sigDeclarations } from '@pkgs/alloy-shared/sigs';

const FIXTURES = join(import.meta.dir, 'fixtures');
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

describe('receipt', () => {
  const receipt = parseReceipt(fixture('spaces-broken.receipt.json'));
  const byName = new Map(receipt.commands.map((c) => [c.name, c]));

  test('every command Alloy ran, with whether it found an instance', () => {
    expect(
      receipt.commands.map((c) => [c.name, c.type, c.expects, c.sat])
    ).toEqual([
      ['HostIsAlwaysMember', 'check', -1, false],
      ['EveryoneBelongsSomewhere', 'check', -1, true],
      ['SomeSpace', 'run', 1, true],
      ['LonelySpace', 'run', -1, false],
    ]);
    expect(byName.get('SomeSpace')?.source).toBe(
      'run SomeSpace { some Space } for 3'
    );
  });

  test('a check holds without a counterexample; a run holds with an instance', () => {
    const pass = (name: string) => {
      const command = byName.get(name);
      if (command === undefined) throw new Error(`no ${name}`);
      return commandVerdict(command).pass;
    };
    expect(pass('HostIsAlwaysMember')).toBe(true);
    expect(pass('EveryoneBelongsSomewhere')).toBe(false);
    expect(pass('SomeSpace')).toBe(true);
    expect(pass('LonelySpace')).toBe(false);
  });

  test('a declared expect decides instead', () => {
    const command = (
      type: 'check' | 'run',
      expects: -1 | 0 | 1,
      sat: boolean
    ): CommandResult => ({
      name: 'c',
      type,
      source: `${type} c`,
      expects,
      sat,
      instance: null,
    });
    const verdicts = [
      commandVerdict(command('check', 1, true)),
      commandVerdict(command('check', 1, false)),
      commandVerdict(command('check', 0, false)),
      commandVerdict(command('run', 0, false)),
      commandVerdict(command('run', 0, true)),
      commandVerdict(command('run', 1, false)),
    ].map((v) => v.pass);
    expect(verdicts).toEqual([true, false, true, true, false, false]);
    expect(commandVerdict(command('run', -1, false)).detail).toContain(
      'no instance within scope'
    );
  });

  test('a solution shows the model relations, not the builtins', () => {
    expect(
      solutionSummary(
        [
          '---Trace---',
          'univ={Person$0, Space$0, -8, 7}',
          'Int={-8, 7}',
          'this/Person={Person$0}',
          'this/Space<:host={Space$0->Person$0}',
          'skolem $Everyone_p={Person$0}',
        ].join('\n')
      )
    ).toBe(
      'Person={Person$0}\nSpace<:host={Space$0->Person$0}\n$Everyone_p={Person$0}'
    );
  });

  test('types are unions of products of sig names', () => {
    expect(parseAlloyType('{Space->Person}')).toEqual([['Space', 'Person']]);
    expect(parseAlloyType('{T->Person, T->R}')).toEqual([
      ['T', 'Person'],
      ['T', 'R'],
    ]);
    expect(parseAlloyType('{Folder, User}')).toEqual([['Folder'], ['User']]);
  });
});

describe('sigs', () => {
  const source = readFileSync(join(FIXTURES, 'folders.als'), 'utf8');
  const sigs = modelSigs(
    parseReceipt(fixture('folders.receipt.json')).sigs,
    source
  );
  const sig = (name: string) => sigs.find((s) => s.name === name);

  test('the hierarchy comes from the source, the fields from the receipt', () => {
    expect(sigs.map((s) => s.name)).toEqual([
      'User',
      'Admin',
      'Guest',
      'Name',
      'Root',
      'Folder',
      'Shared',
      'Tag',
    ]);
    expect(sig('User')?.abstract).toBe(true);
    expect(sig('Admin')?.parent).toBe('User');
    expect(sig('Root')?.multiplicity).toBe('one');
    expect(sig('Shared')?.subsetOf).toEqual(['Folder']);
    expect(sig('Folder')?.fields.map((f) => [f.name, f.arity])).toEqual([
      ['parent', 2],
      ['owner', 2],
      ['perms', 3],
    ]);
    expect(sig('Folder')?.fields[2]?.types).toEqual([
      ['Folder', 'User', 'Name'],
    ]);
  });

  test('declarations read qualifiers, extends, in, enums and skip comments', () => {
    const declared = sigDeclarations(
      [
        '// sig Commented {}',
        'abstract sig A {}',
        'one sig B, C extends A {}',
        '/* sig Hidden {} */',
        'var lone sig D in A + B {}',
        'enum Color { Red, Green }',
        '-- one sig Dashed {}',
      ].join('\n')
    );
    expect(
      declared.map((d) => [
        d.name,
        d.parent,
        d.subsetOf.join('+'),
        d.abstract,
        d.multiplicity,
        d.var,
      ])
    ).toEqual([
      ['A', null, '', true, 'set', false],
      ['B', 'A', '', false, 'one', false],
      ['C', 'A', '', false, 'one', false],
      ['D', null, 'A+B', false, 'lone', true],
      ['Color', null, '', true, 'set', false],
      ['Red', 'Color', '', false, 'one', false],
      ['Green', 'Color', '', false, 'one', false],
    ]);
  });
});
