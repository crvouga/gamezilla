import { expect, test } from 'bun:test';
import {
  taggedActorUsername,
  taggedCreateId,
  taggedUsername,
} from '@libs/harness-ts/run-scope';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('a world on its own server mints its seeded ids and names unchanged', () => {
  const plain = createHarnessIds(1).createId;
  const scoped = taggedCreateId(createHarnessIds(1).createId, null);
  expect([scoped(), scoped()]).toEqual([plain(), plain()]);
  expect(taggedUsername('cedar', null)).toBe('cedar');
});

// regression: stack-population-fixture-collisions
test('two runs on one stack with the same seed mint different ids and names', () => {
  const first = taggedCreateId(createHarnessIds(1).createId, '0a1b2c3d');
  const second = taggedCreateId(createHarnessIds(1).createId, '4e5f6a7b');
  const ids = [first(), first(), second(), second()];
  expect(new Set(ids).size).toBe(4);
  for (const id of ids) expect(id).toMatch(UUID);
  expect(taggedUsername('cedar', '0a1b2c3d')).not.toBe(
    taggedUsername('cedar', '4e5f6a7b')
  );
  expect(taggedUsername('cedar', '0a1b2c3d')).toMatch(/^[a-z0-9_]{3,32}$/);
});

test('a run tag is the eight hex digits a stack run draws', () => {
  expect(() =>
    taggedCreateId(createHarnessIds(1).createId, 'not-a-tag')
  ).toThrow();
});

test("an actor's name carries the run's tag on a shared stack; other names do not", () => {
  expect(taggedActorUsername('alice', null)).toBe('alice');
  expect(taggedActorUsername('alice', '0a1b2c3d')).toBe('alice_0a1b2c3d');
  expect(taggedActorUsername('robert_1', '0a1b2c3d')).toBe('robert_1');
  // Already tagged: the same name, not tagged twice.
  expect(taggedActorUsername('alice_0a1b2c3d', '0a1b2c3d')).toBe(
    'alice_0a1b2c3d'
  );
});
