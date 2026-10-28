import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { tailwindCli } from '@libs/harness-ts/wall-frame-css';
import { REPO_ROOT, reportsStoreUnconfigured } from './report-publish';

describe('report-publish', () => {
  // regression: report-publish-wrangler-not-found
  test('runs the Tailwind CLI the install linked into the package declaring it', () => {
    // `bunx --no-install` finds only a bin in the working directory's
    // node_modules/.bin (or a global install, which a CI runner lacks), and
    // that shim is `tailwindcss` on POSIX but `tailwindcss.exe` on Windows.
    // The repo root has none: the isolated linker links a package only into
    // the packages that declare it, so the CLI script is read from there.
    expect(existsSync(tailwindCli(REPO_ROOT))).toBe(true);
  });

  test('skips only when no reports credential exists', () => {
    expect(reportsStoreUnconfigured({})).toBe(true);
    expect(reportsStoreUnconfigured({ REPORTS_BUCKET: ' ' })).toBe(true);
    // A partly set credential is a misconfiguration, not a missing store.
    expect(reportsStoreUnconfigured({ REPORTS_BUCKET: 'reports' })).toBe(false);
  });
});
