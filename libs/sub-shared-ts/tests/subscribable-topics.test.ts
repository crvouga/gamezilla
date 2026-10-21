import { expect, test } from 'bun:test';
import { canSubscribeToTopic, userTopic } from '@libs/sub-shared-ts/sync';

const bob = { actorId: 'bob' };

// regression: push-subscribes-to-other-peoples-user-topics
test("a person is never asked to subscribe to another person's topic", () => {
  expect(canSubscribeToTopic(userTopic('alice'), bob)).toBe(false);
});

test('a person subscribes to their own topic, rooms and system topics', () => {
  expect(canSubscribeToTopic(userTopic('bob'), bob)).toBe(true);
  expect(canSubscribeToTopic('room:space-1', bob)).toBe(true);
  expect(canSubscribeToTopic('system:chess_puzzles', bob)).toBe(true);
});

test("a topic that only starts like a user topic is not another person's", () => {
  expect(canSubscribeToTopic('room:user:alice', bob)).toBe(true);
});
