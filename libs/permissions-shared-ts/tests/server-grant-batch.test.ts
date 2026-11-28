import { expect, test } from 'bun:test';
import { ClientConfigKey } from '@libs/app-config-shared-ts/client-config-keys';
import {
  decideForActor,
  decideGrantsForActor,
} from '@libs/permissions-shared-ts/decide-for-actor';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import type { AccessReader } from '@libs/permissions-shared-ts/read-access';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';

const NOW = Date.parse('2026-11-15T17:22:55.848Z');
const IDENTITY = { actorId: 'device', accountId: 'account', isAnon: false };
const ROOM_KEYS = [
  PERMISSION.spacesJoin,
  PERMISSION.spacesSelectGame,
  PERMISSION.spacesLeave,
  PERMISSION.spacesEnd,
  PERMISSION.spacesRename,
  PERMISSION.gameSessionCreate,
  PERMISSION.gameSessionConfigure,
  PERMISSION.gameSessionInvite,
  PERMISSION.gameSessionBot,
  PERMISSION.gameSessionStart,
  PERMISSION.gameSessionCancel,
  PERMISSION.gameSessionJoin,
  PERMISSION.gameSessionWatch,
  PERMISSION.gameSessionPlay,
] as const;

function reader() {
  const calls: string[] = [];
  let policy = DEFAULT_PERMISSION_POLICY;
  const db: AccessReader = {
    async query<T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> {
      calls.push(query.sql);
      const rows = query.sql.includes('client_config')
        ? [
            {
              id: ClientConfigKey.permissionPolicy,
              value: JSON.stringify(policy),
              deleted_at: null,
            },
          ]
        : [];
      return rows as unknown as T[];
    },
  };
  return {
    db,
    calls,
    replacePolicy: (next: typeof policy) => {
      policy = next;
    },
  };
}

// regression: room-grants-repeat-access-reads
test('fourteen room grants read the actor access snapshot once', async () => {
  const { db, calls } = reader();
  const grants = await decideGrantsForActor(db, {
    identity: IDENTITY,
    keys: ROOM_KEYS,
    nowMs: NOW,
    clientAtMs: NOW,
    scope: { spacePresence: 'host' },
  });
  expect(grants).toContain(PERMISSION.spacesSelectGame);
  expect(calls.filter((query) => query.includes('client_config'))).toHaveLength(
    1
  );
  expect(
    calls.filter((query) => query.includes('billing_subscriptions'))
  ).toHaveLength(1);
});

test('a later grant batch reads policy changes instead of retaining the first snapshot', async () => {
  const { db, replacePolicy, calls } = reader();
  const args = {
    identity: IDENTITY,
    keys: [PERMISSION.spacesSelectGame],
    nowMs: NOW,
    clientAtMs: NOW,
    scope: { spacePresence: 'host' as const },
  };
  expect(await decideGrantsForActor(db, args)).toEqual(args.keys);
  replacePolicy({
    ...DEFAULT_PERMISSION_POLICY,
    restrictions: {
      ...DEFAULT_PERMISSION_POLICY.restrictions,
      revoked: { when: 'always', deny: args.keys, reason: 'restricted' },
    },
  });
  expect(await decideGrantsForActor(db, args)).toEqual([]);
  expect(calls).toHaveLength(4);
});

test('batch grants equal individual decisions across identities, scopes and key sets', async () => {
  await assertProperty(
    'room grant batching preserves decisions',
    fc.asyncProperty(
      fc.boolean(),
      fc.constantFrom('host' as const, 'guest' as const, null),
      fc.subarray([...ROOM_KEYS]),
      async (anonymous, presence, keys) => {
        const { db } = reader();
        const args = {
          identity: {
            ...IDENTITY,
            accountId: anonymous ? null : 'account',
            isAnon: anonymous,
          },
          nowMs: NOW,
          clientAtMs: NOW,
          scope: { spacePresence: presence },
        };
        const individual = await Promise.all(
          keys.map(async (key) => ({
            key,
            allowed: (await decideForActor(db, { ...args, key })).allowed,
          }))
        );
        expect(await decideGrantsForActor(db, { ...args, keys })).toEqual(
          individual
            .filter((decision) => decision.allowed)
            .map((decision) => decision.key)
        );
      }
    )
  );
});
