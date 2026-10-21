/**
 * The engine end to end, against the real Alloy: model checking, and
 * snapshots of a store audited as worlds of the model — including mutated
 * snapshots and a broken model, which must each be reported (strategy § 21).
 * Every JVM call is batched: one per model, one per snapshot batch.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecAlloyResult } from '@pkgs/alloy-server-ts/alloy-cli';
import { execAlloy } from '@pkgs/alloy-server-ts/alloy-cli';
import {
  auditSnapshots,
  illegalSnapshotReport,
} from '@pkgs/alloy-server-ts/audit';
import { commandVerdict } from '@pkgs/alloy-shared-ts/receipt';
import type { Snapshot } from '@pkgs/alloy-shared-ts/world';

const FIXTURES = join(import.meta.dir, 'fixtures');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');
const SPACES = read('spaces.als');

/** A JVM starts in ~1 s idle, several under a loaded gate. */
const JVM_TIMEOUT_MS = 60_000;

let spaces: ExecAlloyResult | null = null;
const checkedSpaces = (): ExecAlloyResult => {
  spaces ??= execAlloy({ source: SPACES, name: 'spaces' });
  return spaces;
};

const verdicts = (result: ExecAlloyResult) =>
  Object.fromEntries(
    result.commands.map((c) => [c.name, commandVerdict(c).pass])
  );

describe('model checking', () => {
  test(
    'every check of a sound model holds and every run has an instance',
    () => {
      const result = checkedSpaces();
      expect(verdicts(result)).toEqual({
        HostIsAlwaysMember: true,
        SomeSpace: true,
      });
      expect(result.sigs.map((s) => s.name)).toEqual(['Person', 'Space']);
    },
    JVM_TIMEOUT_MS
  );

  test(
    'MUTATION: an assertion the model breaks, and a run no world satisfies, are failures',
    () => {
      const result = execAlloy({
        source: read('spaces-broken.als'),
        name: 'spaces-broken',
      });
      expect(verdicts(result)).toEqual({
        HostIsAlwaysMember: true,
        EveryoneBelongsSomewhere: false,
        SomeSpace: true,
        LonelySpace: false,
      });
      const counterexample = result.commands.find(
        (c) => c.name === 'EveryoneBelongsSomewhere'
      );
      expect(counterexample?.instance).toContain('Person={Person$0}');
      expect(counterexample?.instance).toContain('$EveryoneBelongsSomewhere_p');
    },
    JVM_TIMEOUT_MS
  );

  test(
    "a model Alloy cannot read fails with Alloy's own message",
    () => {
      expect(() =>
        execAlloy({ source: 'sig A {}\nfact { some B }\n', name: 'typo' })
      ).toThrow(/typo\.als at line 2 column 13:\nThe name "B" cannot be found/);
    },
    JVM_TIMEOUT_MS
  );
});

const legal: Snapshot = {
  label: 'alice hosts, bob joins',
  atoms: { Person: ['alice', 'bob', 'carol'], Space: ['s-1'] },
  relations: {
    host: [['s-1', 'alice']],
    members: [
      ['s-1', 'alice'],
      ['s-1', 'bob'],
    ],
  },
};

describe('snapshot audit', () => {
  test(
    'legal snapshots pass; MUTATION: a host outside the space, two hosts, or a stray atom are caught',
    async () => {
      const snapshots: readonly Snapshot[] = [
        legal,
        { label: 'nothing stored', atoms: {}, relations: {} },
        {
          label: 'host is not a member',
          atoms: legal.atoms,
          relations: { ...legal.relations, members: [['s-1', 'bob']] },
        },
        {
          label: 'two hosts',
          atoms: legal.atoms,
          relations: {
            ...legal.relations,
            host: [
              ['s-1', 'alice'],
              ['s-1', 'bob'],
            ],
          },
        },
        {
          label: 'hostless space',
          atoms: legal.atoms,
          relations: { members: legal.relations['members'] ?? [] },
        },
        {
          label: 'member nobody declared',
          atoms: legal.atoms,
          relations: { ...legal.relations, members: [['s-1', 'dave']] },
        },
      ];
      const result = await auditSnapshots({
        modelSource: SPACES,
        snapshots,
        sigs: checkedSpaces().sigs,
        name: 'spaces',
      });
      expect(result.map((v) => [v.label, v.legal])).toEqual([
        ['alice hosts, bob joins', true],
        ['nothing stored', true],
        ['host is not a member', false],
        ['two hosts', false],
        ['hostless space', false],
        ['member nobody declared', false],
      ]);
      expect(result[5]?.problems).toEqual([
        'Space.members tuple s-1->dave names dave, which no sig declares',
      ]);
      const report = illegalSnapshotReport(snapshots, result) ?? '';
      expect(report).toStartWith('4 of 6 snapshots are not legal worlds:');
      expect(report).toContain(
        'snapshot "two hosts" is not a legal world:\n  - Alloy finds no legal world'
      );
      expect(report).toContain('    host = s-1->alice + s-1->bob');
      expect(report).not.toContain('"alice hosts, bob joins"');
    },
    JVM_TIMEOUT_MS
  );

  test(
    'a hierarchy of sigs is pinned leaf by leaf; MUTATION: a cycle or a parented top folder is caught',
    async () => {
      const tree: Snapshot = {
        label: 'tree',
        atoms: {
          Admin: ['ada'],
          Guest: ['gus'],
          Name: ['n1', 'n2'],
          Root: ['root'],
          Folder: ['f1', 'f2'],
          Shared: ['f2'],
          Tag: ['t1'],
        },
        relations: {
          'User.name': [['ada', 'n1']],
          'Tag.name': [['t1', 'n2']],
          top: [['root', 'f1']],
          parent: [['f2', 'f1']],
          owner: [
            ['f1', 'ada'],
            ['f2', 'gus'],
          ],
          perms: [['f2', 'gus', 'n1']],
        },
      };
      const result = await auditSnapshots({
        modelSource: read('folders.als'),
        name: 'folders',
        snapshots: [
          tree,
          {
            ...tree,
            label: 'cycle',
            relations: {
              ...tree.relations,
              parent: [
                ['f2', 'f1'],
                ['f1', 'f2'],
              ],
            },
          },
          {
            ...tree,
            label: 'top folder has a parent',
            relations: { ...tree.relations, top: [['root', 'f2']] },
          },
        ],
      });
      expect(result.map((v) => [v.label, v.legal])).toEqual([
        ['tree', true],
        ['cycle', false],
        ['top folder has a parent', false],
      ]);
    },
    JVM_TIMEOUT_MS
  );

  test('a model with var or Int fields cannot be audited', async () => {
    await expect(
      auditSnapshots({
        modelSource: 'sig A { n: Int }',
        snapshots: [legal],
        sigs: [
          {
            name: 'A',
            parent: null,
            subsetOf: [],
            abstract: false,
            multiplicity: 'set',
            var: false,
            fields: [
              {
                name: 'n',
                owner: 'A',
                arity: 2,
                types: [['A', 'Int']],
                var: false,
              },
            ],
          },
        ],
      })
    ).rejects.toThrow('field A.n holds Int values');
  });
});
