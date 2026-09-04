import { afterAll } from 'bun:test';

import { closeSharedPglite } from './helpers/backends';

afterAll(async () => {
  await closeSharedPglite();
});
