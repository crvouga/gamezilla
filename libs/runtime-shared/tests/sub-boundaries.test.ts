import { test } from 'bun:test';
import { APP_SUBS } from '@libs/runtime-shared/app-subs';
import { assertTableBoundaries } from '@libs/sub-shared/boundaries';

test("every sub's queries read only its own tables plus declared readsForeign", async () => {
  await assertTableBoundaries(APP_SUBS);
});
