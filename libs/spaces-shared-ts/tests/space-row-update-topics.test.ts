import { expect, test } from 'bun:test';
import { SPACES_TOPIC_MAP } from '@libs/spaces-shared-ts/topic-map';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { topicsFromHeldRows } from '@pkgs/sync-engine-shared-ts/topic-map';
import fc from 'fast-check';

const ctx = {
  actorId: 'bob',
  deviceId: 'phone',
  accountId: 'bob',
  isAnon: false,
};

function project(
  spaces: readonly Record<string, unknown>[],
  memberships: readonly Record<string, unknown>[]
) {
  return topicsFromHeldRows({
    topicMap: SPACES_TOPIC_MAP,
    // mySpaces/spaceByLink hydrate spaces independently of mySpaceUsers.
    liveRowsByTable: { spaces },
    held: { spaces, spaces_users: memberships },
    entryTopics: ['user:bob'],
    ctx,
  });
}

// regression: space-query-misses-member-room-updates
test('Bob’s space-row scope subscribes to room updates after his held membership arrives', () => {
  const spaces = [{ id: 'Trip', ended_at: null, deleted_at: null }];
  expect(project(spaces, [])).toEqual(['user:bob']);
  expect(
    project(spaces, [{ space_id: 'Trip', user_id: 'bob', deleted_at: null }])
  ).toEqual(['room:Trip', 'user:bob']);
  expect(
    project(spaces, [{ space_id: 'Trip', user_id: 'alice', deleted_at: null }])
  ).toEqual(['user:bob']);
});

test('space-row scopes only subscribe to live spaces with the observer’s live membership', async () => {
  await assertProperty(
    'space query room projection follows held membership and lifecycle',
    fc.asyncProperty(
      fc.array(
        fc.record({
          ended: fc.boolean(),
          deleted: fc.boolean(),
          member: fc.boolean(),
          memberDeleted: fc.boolean(),
          otherMember: fc.boolean(),
        }),
        { minLength: 1, maxLength: 12 }
      ),
      async (states) => {
        const spaces = states.map((state, i) => ({
          id: `space-${i}`,
          ended_at: state.ended ? 'ended' : null,
          deleted_at: state.deleted ? 'deleted' : null,
        }));
        const memberships = states.flatMap((state, i) => [
          ...(state.member
            ? [
                {
                  space_id: `space-${i}`,
                  user_id: 'bob',
                  deleted_at: state.memberDeleted ? 'deleted' : null,
                },
              ]
            : []),
          ...(state.otherMember
            ? [{ space_id: `space-${i}`, user_id: 'alice', deleted_at: null }]
            : []),
        ]);
        const expected = states.flatMap((state, i) =>
          !state.ended && !state.deleted && state.member && !state.memberDeleted
            ? [`room:space-${i}`]
            : []
        );
        expect(project(spaces, memberships)).toEqual(
          [...expected, 'user:bob'].sort()
        );
      }
    )
  );
});
