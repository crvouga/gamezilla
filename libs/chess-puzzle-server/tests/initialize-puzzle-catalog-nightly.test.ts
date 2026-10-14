import { expect, test } from 'bun:test';
import { csv, openCatalog } from './initialize-puzzle-catalog-fixture';

test('two hundred catalog fixtures start with independent empty catalogs', async () => {
  // regression: catalog-fixtures-repeat-schema-work
  const text = csv('00000000-0000-4000-8000-000000000001', 2400);
  for (let example = 0; example < 200; example += 1) {
    const catalog = await openCatalog(text);
    try {
      expect((await catalog.initialize.run())?.rowsInserted).toBe(1);
    } finally {
      await catalog.close();
    }
  }
});
