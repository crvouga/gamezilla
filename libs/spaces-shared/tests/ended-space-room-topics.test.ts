import { expect, test } from 'bun:test';
import { SPACES_TOPIC_MAP } from '@libs/spaces-shared/topic-map';
import { topicsFromHeldRows } from '@pkgs/sync-engine-shared/topic-map';

const CTX = {
  actorId: 'me',
  deviceId: 'phone',
  accountId: 'me',
  isAnon: false,
};

const spaces = [
  { id: 'live', ended_at: null },
  { id: 'over', ended_at: '2026-10-19T00:00:00.000Z' },
];

const memberships = [
  { id: 'm1', space_id: 'live', user_id: 'me' },
  { id: 'm2', space_id: 'over', user_id: 'me' },
  { id: 'm3', space_id: 'live', user_id: 'friend' },
];

// regression: mqtt-ended-space-rooms-never-granted
test('a person subscribes to the rooms of live spaces only', () => {
  expect(
    topicsFromHeldRows({
      topicMap: SPACES_TOPIC_MAP,
      liveRowsByTable: { spaces_users: memberships },
      held: { spaces, spaces_users: memberships },
      entryTopics: [],
      ctx: CTX,
    })
  ).toEqual(['room:live']);
});

test('a membership whose space is not held yet still subscribes', () => {
  expect(
    topicsFromHeldRows({
      topicMap: SPACES_TOPIC_MAP,
      liveRowsByTable: { spaces_users: memberships },
      held: { spaces_users: memberships },
      entryTopics: [],
      ctx: CTX,
    })
  ).toEqual(['room:live', 'room:over']);
});
