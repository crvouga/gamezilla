import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { reportsStoreUnconfigured, TAILWIND_DIR } from './report-publish';

describe('report-publish', () => {
  // regression: report-publish-wrangler-not-found
  test('runs the Tailwind CLI where the install linked its bin', () => {
    // `bunx --no-install` finds only a bin in the working directory's
    // node_modules/.bin (or a global install, which a CI runner lacks). The
    // repo root has none: the isolated linker links a bin only into the
    // packages that declare it.
    expect(
      existsSync(join(TAILWIND_DIR, 'node_modules/.bin/tailwindcss'))
    ).toBe(true);
  });

  test('skips only when no reports credential exists', () => {
    expect(reportsStoreUnconfigured({})).toBe(true);
    expect(reportsStoreUnconfigured({ REPORTS_BUCKET: ' ' })).toBe(true);
    // A partly set credential is a misconfiguration, not a missing store.
    expect(reportsStoreUnconfigured({ REPORTS_BUCKET: 'reports' })).toBe(false);
  });
});
