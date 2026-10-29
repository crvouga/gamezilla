import { describe, expect, test } from 'bun:test';
import { envFile } from '@libs/infra-shared-ts/envs';
import type {
  RoomMigration,
  WorkerNamespace,
} from '@libs/infra-shared-ts/worker-lifecycle';
import {
  assertRoomNamespacePreserved,
  assertWorkersRetirable,
  ROOM_ARCHIVE_CLASS,
  ROOM_ARCHIVE_TAG,
  ROOM_CLASS,
  ROOM_MIGRATION_TAG,
  ROOM_TRANSFER_TAG,
  roomMigrations,
} from '@libs/infra-shared-ts/worker-lifecycle';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { unstable_getDurableObjectClassNameToUseSQLiteMap } from 'wrangler';

const dev = envFile('dev');

// Literal inventory from the failed deploy; hostnames still used the old Workers.
const source = {
  id: 'ab56d7be4eac481e81df42eac8c99aac',
  script: technicalName(['room', 'development']),
  class: ROOM_CLASS,
};
const target = {
  id: '76e8864ea97c4d329171afb8778fb729',
  script: technicalName(['dev']),
  class: ROOM_CLASS,
};
const archive = { ...target, class: ROOM_ARCHIVE_CLASS };
const active = { ...source, script: target.script };

function applyMigration(
  migration: RoomMigration,
  inventory: readonly WorkerNamespace[],
  applied: Set<string>
): readonly WorkerNamespace[] {
  if (applied.has(migration.tag)) return inventory;
  applied.add(migration.tag);
  let result = inventory;
  for (const rename of migration.renamed_classes ?? []) {
    result = result.map((ns) =>
      ns.script === dev.worker.name && ns.class === rename.from
        ? { ...ns, class: rename.to }
        : ns
    );
  }
  for (const transfer of migration.transferred_classes ?? []) {
    result = result.map((ns) =>
      ns.script === transfer.from_script && ns.class === transfer.from
        ? { ...ns, script: dev.worker.name, class: transfer.to }
        : ns
    );
  }
  return result;
}

describe('explicit room namespace resolution', () => {
  // regression: room-archive-migration-history
  test('Wrangler validates retention history before upload and on redeployment', () => {
    const incomplete = [
      { tag: ROOM_MIGRATION_TAG },
      {
        tag: ROOM_ARCHIVE_TAG,
        renamed_classes: [{ from: ROOM_CLASS, to: ROOM_ARCHIVE_CLASS }],
      },
      {
        tag: ROOM_TRANSFER_TAG,
        transferred_classes: [
          { from: ROOM_CLASS, from_script: source.script, to: ROOM_CLASS },
        ],
      },
    ];
    expect(() =>
      unstable_getDurableObjectClassNameToUseSQLiteMap(incomplete)
    ).toThrow(
      'Cannot apply renamed_classes migration to non-existent class RoomServerDurableObject'
    );
    for (const inventory of [
      [source, target],
      [source, archive],
      [active, archive],
    ]) {
      const migrations = roomMigrations(dev, inventory).map((step) => ({
        ...step,
        new_sqlite_classes: step.new_sqlite_classes?.slice(),
        renamed_classes: step.renamed_classes?.map((item) => ({ ...item })),
        transferred_classes: step.transferred_classes?.map((item) => ({
          ...item,
        })),
      }));
      expect(
        unstable_getDurableObjectClassNameToUseSQLiteMap(migrations).get(
          ROOM_ARCHIVE_CLASS
        )
      ).toBe(true);
    }
  });
  // regression: deploy-dev-duplicate-room-namespaces
  test('retains the destination before transferring the still-active legacy rooms', () => {
    expect(roomMigrations(dev, [target, source])).toEqual([
      { tag: ROOM_MIGRATION_TAG, new_sqlite_classes: [ROOM_CLASS] },
      {
        tag: ROOM_ARCHIVE_TAG,
        renamed_classes: [{ from: ROOM_CLASS, to: ROOM_ARCHIVE_CLASS }],
      },
      {
        tag: ROOM_TRANSFER_TAG,
        transferred_classes: [
          { from: ROOM_CLASS, from_script: source.script, to: ROOM_CLASS },
        ],
      },
    ]);
    assertRoomNamespacePreserved(dev, [target, source], [archive, active]);
    const domains = [dev.hosts.api, dev.hosts.web, dev.hosts.apex].map(
      (hostname) => ({ hostname, service: dev.worker.name })
    );
    assertWorkersRetirable(dev, [archive, active], domains);
  });

  test('retains committed history after retention and transfer', () => {
    const initial = roomMigrations(dev, [source, target]);
    expect(roomMigrations(dev, [source, archive])).toEqual(initial);
    expect(roomMigrations(dev, [active, archive])).toEqual(initial);
    assertRoomNamespacePreserved(dev, [source, archive], [active, archive]);
    assertRoomNamespacePreserved(dev, [active, archive], [archive, active]);
  });

  test('rejects changed IDs, missing retained data and an occupied archive class', () => {
    for (const inventory of [
      [{ ...source, id: 'unexpected' }, target],
      [source, { ...target, id: 'unexpected' }],
      [source, target, archive],
      [active, { ...archive, id: 'unexpected' }],
      [archive],
      [active],
      [target],
      [source],
    ]) {
      expect(() => roomMigrations(dev, inventory)).toThrow('does not match');
    }
    expect(() =>
      assertRoomNamespacePreserved(dev, [source, target], [active])
    ).toThrow('Retained room namespace was not preserved');
    expect(() =>
      assertRoomNamespacePreserved(dev, [source, target], [archive, target])
    ).toThrow('was not preserved');
  });

  test('new standard replicas can create and redeploy their own namespace', () => {
    expect(roomMigrations(dev, [])[0]?.new_sqlite_classes).toEqual([
      ROOM_CLASS,
    ]);
    expect(roomMigrations(dev, [{ ...target, id: 'rebuilt-data' }])).toEqual([
      { tag: ROOM_MIGRATION_TAG },
    ]);
  });

  test('preservation is independent of inventory ordering', () => {
    assertProperty(
      'both retained IDs survive regardless of provider inventory order',
      fc.property(fc.boolean(), fc.boolean(), (reverseBefore, reverseAfter) => {
        const before = reverseBefore ? [source, target] : [target, source];
        const after = reverseAfter ? [active, archive] : [archive, active];
        assertRoomNamespacePreserved(dev, before, after);
      })
    );
  });

  test('ordered migrations preserve arbitrary namespace identities through resume and redeploy', () => {
    assertProperty(
      'retention and transfer keep both namespace identities',
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 2 }),
        (ids) => {
          const [sourceId, targetId] = ids;
          if (sourceId === undefined || targetId === undefined)
            throw new Error('IDs missing');
          const env = {
            ...dev,
            worker: {
              ...dev.worker,
              room_namespace_resolution: {
                source_id: sourceId,
                target_id: targetId,
              },
            },
          };
          const before = [
            { ...source, id: sourceId },
            { ...target, id: targetId },
          ];
          let inventory: readonly WorkerNamespace[] = before;
          const applied = new Set([ROOM_MIGRATION_TAG]);
          const plan = roomMigrations(env, inventory);
          for (const step of plan) {
            inventory = applyMigration(step, inventory, applied);
            // A restart after any committed step must converge to the same storage.
            const resumedTags = new Set(applied);
            const resumed = roomMigrations(env, inventory).reduce(
              (state, migration) =>
                applyMigration(migration, state, resumedTags),
              inventory
            );
            assertRoomNamespacePreserved(env, before, resumed);
          }
          expect(inventory.map((ns) => ns.id).sort()).toEqual([...ids].sort());
          assertRoomNamespacePreserved(env, before, inventory);
          expect(
            roomMigrations(env, inventory).reduce(
              (state, migration) => applyMigration(migration, state, applied),
              inventory
            )
          ).toEqual(inventory);
        }
      )
    );
  });
});
