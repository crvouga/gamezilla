import { expect, test } from 'bun:test';
import {
  decideInMutation,
  requireInMutation,
} from '@libs/permissions-shared-ts/mutation-permission';
import {
  decideInMutationSnapshot,
  readMutationPermissionSnapshot,
  requireInMutationSnapshot,
} from '@libs/permissions-shared-ts/mutation-permission-snapshot';
import { CASE_NOW_MS } from '@libs/permissions-shared-ts/people';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  refusal,
  replaceSnapshotPolicy,
  snapshotPolicy,
  snapshotWorld,
} from './mutation-snapshot-fixture';

const keys = Object.values(PERMISSION);
const operation = fc.record({
  key: fc.constantFrom(...keys),
  spacePresence: fc.constantFrom('host', 'guest', null),
});
const input = fc.record({
  person: fc.constantFrom('guest', 'free account', 'Plus member'),
  payments: fc.boolean(),
  atMs: fc.constantFrom(CASE_NOW_MS - 1, CASE_NOW_MS, CASE_NOW_MS + 1),
  denied: fc.subarray(keys),
  operations: fc.array(operation, { minLength: 1, maxLength: 8 }),
});

test('one explicit snapshot preserves every generated grant decision, scope and refusal', async () => {
  await assertProperty(
    'mutation grant snapshots preserve permission enforcement',
    fc.asyncProperty(input, async (value) => {
      const { db, env } = await snapshotWorld({
        ...value,
        policy: snapshotPolicy(value.denied),
      });
      let reads = 0;
      const ctx = {
        env,
        tx: {
          query: async <T extends Record<string, unknown>>(
            query: Parameters<typeof db.query<T>>[0]
          ) => {
            reads++;
            return db.query(query);
          },
          run: db.run.bind(db),
        },
      };
      try {
        const snapshot = await readMutationPermissionSnapshot(ctx);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(reads).toBe(value.person === 'guest' ? 1 : 2);
        for (const { key, spacePresence } of value.operations) {
          const scope = { spacePresence };
          const expected = await decideInMutation(ctx, key, scope);
          const expectedRefusal = await refusal(() =>
            requireInMutation(ctx, key, scope)
          );
          const before = reads;
          expect(decideInMutationSnapshot(snapshot, key, scope)).toEqual(
            expected
          );
          expect(
            await refusal(() => requireInMutationSnapshot(snapshot, key, scope))
          ).toEqual(expectedRefusal);
          expect(reads).toBe(before);
        }
      } finally {
        await db.disconnect();
      }
    })
  );
});

test('new snapshots read changed policy while captured snapshots retain their own policy', async () => {
  await assertProperty(
    'permission snapshots have no cross-call database cache',
    fc.asyncProperty(operation, async ({ key, spacePresence }) => {
      const { db, env } = await snapshotWorld({
        person: 'free account',
        payments: true,
        atMs: CASE_NOW_MS,
        policy: snapshotPolicy([]),
      });
      const ctx = { tx: db, env };
      try {
        const first = await readMutationPermissionSnapshot(ctx);
        const before = decideInMutationSnapshot(first, key, { spacePresence });
        await replaceSnapshotPolicy(db, snapshotPolicy([key]));
        const second = await readMutationPermissionSnapshot(ctx);
        expect(decideInMutationSnapshot(first, key, { spacePresence })).toEqual(
          before
        );
        expect(
          decideInMutationSnapshot(second, key, { spacePresence })
        ).toEqual(await decideInMutation(ctx, key, { spacePresence }));
        expect(
          decideInMutationSnapshot(second, key, { spacePresence }).allowed
        ).toBe(false);
        expect(
          decideInMutationSnapshot(second, key, { spacePresence }).reason
        ).toBe('restricted');
      } finally {
        await db.disconnect();
      }
    })
  );
});
