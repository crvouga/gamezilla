import { test } from 'bun:test';
import { assertTableBoundaries } from '@libs/feature-shared/boundaries';
import { APP_FEATURES } from '@libs/runtime-shared/app-features';

test("every feature's queries read only its own tables plus declared readsForeign", async () => {
  await assertTableBoundaries(APP_FEATURES);
});
