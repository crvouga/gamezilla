import { afterAll } from 'bun:test';

import { closeSharedPglite } from '../backends';

afterAll(async () => {
  await closeSharedPglite();
});
