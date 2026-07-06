import { ensureChessPuzzlesSeeded } from '../e2e/setup/ensure-chess-puzzles-seeded';
import { resolveGamezillaRepoRoot } from '../src/qa-playwright-paths';

import { assertPlaywrightPreviewEnvReady } from './playwright-preview-env';

export default async function globalSetup(): Promise<void> {
  assertPlaywrightPreviewEnvReady();
  const repoRoot = resolveGamezillaRepoRoot(__dirname);
  await ensureChessPuzzlesSeeded(repoRoot);
}
