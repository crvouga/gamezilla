import { describe, expect, test } from 'bun:test';
import { ENV_FILES } from '@libs/infra-shared/envs';
import type { WorkerNamespace } from '@libs/infra-shared/worker-lifecycle';
import {
  assertRoomNamespacePreserved,
  assertWorkersRetirable,
  ROOM_CLASS,
  ROOM_MIGRATION_TAG,
  roomMigrations,
} from '@libs/infra-shared/worker-lifecycle';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const configuredDev = ENV_FILES['dev'];
const dev = configuredDev && {
  ...configuredDev,
  worker: {
    name: configuredDev.worker.name,
    transfer_rooms_from: configuredDev.worker.transfer_rooms_from,
    retire: configuredDev.worker.retire,
    puzzle_manager_account_ids: configuredDev.worker.puzzle_manager_account_ids,
  },
};
const prd = ENV_FILES['prd'];
if (dev === undefined || prd === undefined)
  throw new Error('Environment files missing');

const source: WorkerNamespace = {
  id: 'existing-room-data',
  script: dev.worker.transfer_rooms_from ?? '',
  class: ROOM_CLASS,
};
const target = { ...source, script: dev.worker.name };
const domains = [dev.hosts.api, dev.hosts.web, dev.hosts.apex].map(
  (hostname) => ({
    hostname,
    service: dev.worker.name,
  })
);

describe('application Worker storage adoption', () => {
  test('any adopted namespace retains its identity through repeated deployments', () => {
    assertProperty(
      'room namespace identity survives adoption and redeployment',
      fc.property(fc.uuid(), (id) => {
        const existing = { ...source, id };
        const adopted = { ...target, id };
        const [initial] = roomMigrations(dev, [existing]);
        if (initial === undefined) throw new Error('Migration missing');
        expect(initial.new_sqlite_classes).toBeUndefined();
        expect(initial.transferred_classes?.[0]?.from_script).toBe(
          existing.script
        );
        assertRoomNamespacePreserved(dev, [existing], [adopted]);
        expect(roomMigrations(dev, [adopted])).toEqual([
          {
            tag: ROOM_MIGRATION_TAG,
          },
        ]);
        assertRoomNamespacePreserved(dev, [adopted], [adopted]);
      })
    );
  });
  test('transfers the existing namespace without creating a replacement', () => {
    expect(roomMigrations(dev, [source])).toEqual([
      {
        tag: ROOM_MIGRATION_TAG,
        transferred_classes: [
          {
            from: ROOM_CLASS,
            from_script: source.script,
            to: ROOM_CLASS,
          },
        ],
      },
    ]);
  });

  test('subsequent deploys keep the adopted namespace', () => {
    expect(roomMigrations(dev, [target])).toEqual([
      { tag: ROOM_MIGRATION_TAG },
    ]);
  });

  test('a rebuilt standard environment creates fresh storage', () => {
    expect(roomMigrations(dev, [])).toEqual([
      {
        tag: ROOM_MIGRATION_TAG,
        new_sqlite_classes: [ROOM_CLASS],
      },
    ]);
  });

  test('missing production storage fails closed', () => {
    expect(() => roomMigrations(prd, [])).toThrow(
      'Production room storage is missing'
    );
  });

  test('conflicting namespaces fail instead of abandoning either database', () => {
    expect(() =>
      roomMigrations(dev, [source, { ...target, id: 'other-data' }])
    ).toThrow('Both room namespaces exist');
  });

  test('checks that deployment preserves the exact namespace ID', () => {
    expect(() =>
      assertRoomNamespacePreserved(dev, [source], [target])
    ).not.toThrow();
    expect(() =>
      assertRoomNamespacePreserved(dev, [target], [target])
    ).not.toThrow();
    expect(() => assertRoomNamespacePreserved(dev, [], [target])).not.toThrow();
    expect(() => assertRoomNamespacePreserved(dev, [source], [])).toThrow(
      'was not preserved'
    );
    expect(() =>
      assertRoomNamespacePreserved(
        dev,
        [source],
        [{ ...target, id: 'replacement' }]
      )
    ).toThrow('was not preserved');
  });
});

describe('superseded Worker retirement', () => {
  test('allows retirement once all hosts and storage have moved', () => {
    expect(() => assertWorkersRetirable(dev, [target], domains)).not.toThrow();
  });

  test('refuses retirement of any Worker still owning storage', () => {
    expect(() =>
      assertWorkersRetirable(dev, [source, target], domains)
    ).toThrow('still owns namespace');
  });

  test('refuses incomplete domain cutover and additional old routes', () => {
    expect(() =>
      assertWorkersRetirable(dev, [target], domains.slice(1))
    ).toThrow('has not moved');
    expect(() =>
      assertWorkersRetirable(
        dev,
        [target],
        [...domains, { hostname: 'extra.example.test', service: source.script }]
      )
    ).toThrow('still serves extra.example.test');
  });

  test('refuses missing destination storage or retirement of the new application', () => {
    expect(() => assertWorkersRetirable(dev, [], domains)).toThrow(
      'namespace is missing'
    );
    expect(() =>
      assertWorkersRetirable(
        {
          ...dev,
          worker: { ...dev.worker, retire: [dev.worker.name] },
        },
        [target],
        domains
      )
    ).toThrow('Cannot retire the application Worker');
  });
});
