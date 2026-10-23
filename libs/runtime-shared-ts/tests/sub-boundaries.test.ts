import { test } from 'bun:test';
import { APP_SUBS } from '@libs/runtime-shared-ts/app-subs';
import { assertTableBoundaries } from '@libs/sub-shared-ts/boundaries';

test("every sub's queries read only its own tables plus declared readsForeign", async () => {
  await assertTableBoundaries(APP_SUBS);
});
