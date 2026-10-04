import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseReceipt } from '@pkgs/alloy-shared/receipt';
import { modelSigs } from '@pkgs/alloy-shared/sigs';
import type { SigInfo } from '@pkgs/alloy-shared/sigs';
import { modelProblems, snapshotPredicate, snapshotProblems } from '@pkgs/alloy-shared/snapshot';
import type { Snapshot } from '@pkgs/alloy-shared/world';

const FIXTURES = join(import.meta.dir, 'fixtures');

function sigsOf(model: string, receipt: string): readonly SigInfo[] {
  return modelSigs(
    parseReceipt(JSON.parse(readFileSync(join(FIXTURES, receipt), 'utf8')))
      .sigs,
    readFileSync(join(FIXTURES, model), 'utf8')
  );
}

const SPACES = sigsOf('spaces.als', 'spaces-broken.receipt.json');
const FOLDERS = sigsOf('folders.als', 'folders.receipt.json');

const hosted: Snapshot = {
  label: 'one hosted space',
  atoms: { Person: ['bob', 'alice'], Space: ['s-1'] },
  relations: {
    host: [['s-1', 'alice']],
    members: [
      ['s-1', 'bob'],
      ['s-1', 'alice'],
    ],
  },
};

describe('snapshotPredicate', () => {
  test('pins every sig and field to the snapshot, atoms sorted', () => {
    expect(snapshotPredicate(hosted, SPACES, 0)).toBe(
      [
        'pred snapshot_0 {',
        '  some disj atom_alice, atom_bob: Person, disj atom_s_2d_1: Space |',
        '    Person = atom_alice + atom_bob',
        '    and Space = atom_s_2d_1',
        '    and host = atom_s_2d_1->atom_alice',
        '    and members = atom_s_2d_1->atom_alice + atom_s_2d_1->atom_bob',
        '}',
        'run snapshot_0 for exactly 2 Person, exactly 1 Space',
        '',
      ].join('\n')
    );
  });

  test('an empty snapshot pins every sig and field to nothing', () => {
    expect(
      snapshotPredicate({ label: 'empty', atoms: {}, relations: {} }, SPACES, 3)
    ).toBe(
      [
        'pred snapshot_3 {',
        '  no Person',
        '  and no Space',
        '  and no host',
        '  and no members',
        '}',
        'run snapshot_3 for exactly 0 Person, exactly 0 Space',
        '',
      ].join('\n')
    );
  });

  test('pins leaf sigs, scopes parents by their total, qualifies shared field names', () => {
    const text = snapshotPredicate(
      {
        label: 'tree',
        atoms: {
          Admin: ['ada'],
          Guest: ['gus'],
          Name: ['n1'],
          Root: ['root'],
          Folder: ['f1', 'f2'],
          Shared: ['f2'],
        },
        relations: {
          'User.name': [['ada', 'n1']],
          top: [['root', 'f1']],
          parent: [['f2', 'f1']],
          owner: [
            ['f1', 'ada'],
            ['f2', 'gus'],
          ],
          perms: [['f1', 'gus', 'n1']],
        },
      },
      FOLDERS,
      1
    );
    expect(text).toContain(
      'some disj atom_ada: Admin, disj atom_gus: Guest, disj atom_n1: Name, disj atom_root: Root, disj atom_f1, atom_f2: Folder |'
    );
    expect(text).toContain('User = atom_ada + atom_gus');
    expect(text).toContain('and Shared = atom_f2');
    expect(text).toContain('and (User <: name) = atom_ada->atom_n1');
    expect(text).toContain('and no (Tag <: name)');
    expect(text).toContain('and perms = atom_f1->atom_gus->atom_n1');
    expect(text).toContain(
      'run snapshot_1 for exactly 2 User, exactly 1 Admin, exactly 1 Guest, exactly 1 Name, exactly 1 Root, exactly 2 Folder, exactly 0 Tag'
    );
  });

  test('refuses a snapshot it cannot pin', () => {
    expect(() =>
      snapshotPredicate(
        { label: 'bad', atoms: { Ghost: ['g'] }, relations: {} },
        SPACES,
        0
      )
    ).toThrow('snapshot bad cannot be pinned:\n  unknown sig Ghost');
  });
});

describe('snapshotProblems', () => {
  test('a snapshot that is a world has none', () => {
    expect(snapshotProblems(hosted, SPACES)).toEqual([]);
  });

  test('names what keeps a snapshot from being a world', () => {
    const problems = snapshotProblems(
      {
        label: 'broken',
        atoms: {
          Person: ['alice', 'alice'],
          Space: ['s1', 'bob'],
          Ghost: ['x'],
        },
        relations: {
          host: [
            ['s1', 'alice', 'alice'],
            ['s1', 'carol'],
            ['alice', 's1'],
          ],
          visitors: [],
        },
      },
      SPACES
    );
    expect(problems).toEqual([
      'atom alice is declared twice (in Person and Person)',
      'unknown sig Ghost',
      'Space.host tuple s1->alice->alice has 3 atoms, the field has arity 2',
      'Space.host tuple s1->carol names carol, which no sig declares',
      'Space.host tuple alice->s1 is not of type Space->Person',
      'unknown field visitors',
    ]);
  });

  test('checks the hierarchy: abstract parents, one sigs, subset sigs, shared names', () => {
    const problems = snapshotProblems(
      {
        label: 'hierarchy',
        atoms: {
          User: ['u'],
          Root: [],
          Folder: ['f'],
          Shared: ['n'],
          Name: ['n'],
        },
        relations: { name: [] },
      },
      FOLDERS
    );
    expect(problems).toEqual([
      'abstract sig User holds no atoms of its own — declare u in one of its subsigs',
      'one sig Root has 0 atoms',
      'atom n of subset sig Shared is not in Folder',
      'field name is ambiguous — name it User.name, Tag.name',
    ]);
  });

  test('an atom whose Alloy name the model already uses', () => {
    const sigs: readonly SigInfo[] = [
      {
        name: 'atom_x',
        parent: null,
        subsetOf: [],
        abstract: false,
        multiplicity: 'set',
        var: false,
        fields: [],
      },
    ];
    expect(
      snapshotProblems(
        { label: 'clash', atoms: { atom_x: ['x'] }, relations: {} },
        sigs
      )
    ).toEqual(['atom x is written atom_x, a name the model already uses']);
  });
});

describe('modelProblems', () => {
  test('var sigs, var fields and Int-valued fields cannot be pinned', () => {
    const base = {
      parent: null,
      subsetOf: [],
      abstract: false,
      multiplicity: 'set',
    } as const;
    expect(
      modelProblems([
        { ...base, name: 'Live', var: true, fields: [] },
        {
          ...base,
          name: 'Doc',
          var: false,
          fields: [
            {
              name: 'tag',
              owner: 'Doc',
              arity: 2,
              types: [['Doc', 'Live']],
              var: true,
            },
            {
              name: 'size',
              owner: 'Doc',
              arity: 2,
              types: [['Doc', 'Int']],
              var: false,
            },
          ],
        },
      ])
    ).toEqual([
      'var sig Live: a snapshot is one state',
      'var field Doc.tag: a snapshot is one state',
      'field Doc.size holds Int values, which a snapshot cannot pin — model the value as a sig',
    ]);
    expect(modelProblems(SPACES)).toEqual([]);
  });
});
