import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { WRANGLER_CWD } from './report-publish';

describe('report-publish', () => {
  // regression: report-publish-wrangler-not-found
  test('runs wrangler where the install linked its bin', () => {
    // `bunx --no-install` finds only a bin in the working directory's
    // node_modules/.bin (or a global install, which a CI runner lacks). The
    // repo root has none: the isolated linker links wrangler only into the
    // packages that declare it.
    expect(existsSync(join(WRANGLER_CWD, 'node_modules/.bin/wrangler'))).toBe(
      true
    );
  });
});
