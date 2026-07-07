import { clerkSetup } from '@clerk/testing/playwright';
import { ensureChessPuzzlesSeeded } from '../e2e/setup/ensure-chess-puzzles-seeded';
import { resolveGamezillaRepoRoot } from '../src/qa-playwright-paths';

import { assertPlaywrightPreviewEnvReady } from './playwright-preview-env';
import { applyClerkPlaywrightEnv } from './playwright-clerk-env';

export default async function globalSetup(): Promise<void> {
  assertPlaywrightPreviewEnvReady();
  applyClerkPlaywrightEnv();
  await clerkSetup();
  const repoRoot = resolveGamezillaRepoRoot(__dirname);
  await ensureChessPuzzlesSeeded(repoRoot);
}
