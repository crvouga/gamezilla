import { expect } from 'bun:test';
import { Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { endOffered } from '@libs/spaces-harness/space-ending-ui-reads';

Then('{actor} can end the space', async (w, actor: Actor) => {
  expect(await w.s.read(endOffered, actor)).toBe(true);
});

Then('{actor} is not offered to end the space', async (w, actor: Actor) => {
  expect(await w.s.read(endOffered, actor)).toBe(false);
});
