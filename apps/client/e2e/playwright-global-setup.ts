import path from 'node:path';

import { ensureChessPuzzlesSeeded } from '@libs/chess/e2e/ensure-chess-puzzles-seeded';

import { assertPlaywrightPreviewEnvReady } from './playwright-preview-env';

export default async function globalSetup(): Promise<void> {
  assertPlaywrightPreviewEnvReady();
  const repoRoot = path.join(__dirname, '..', '..', '..');
  await ensureChessPuzzlesSeeded(repoRoot);
}
