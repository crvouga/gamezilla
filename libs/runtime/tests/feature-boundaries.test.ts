import { test } from 'bun:test';
import { assertTableBoundaries } from '@libs/feature/public/boundaries';
import { APP_FEATURES } from '@libs/runtime/root/app-features';

test("every feature's queries read only its own tables plus declared readsForeign", async () => {
  await assertTableBoundaries(APP_FEATURES);
});
