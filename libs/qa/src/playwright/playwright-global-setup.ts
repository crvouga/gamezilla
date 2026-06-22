import path from 'node:path';

import { assertPlaywrightPreviewEnvReady } from './playwright-preview-env';
import { ensureChessPuzzlesSeeded } from './ensure-chess-puzzles-seeded';

export default async function globalSetup(): Promise<void> {
  assertPlaywrightPreviewEnvReady();
  const repoRoot = path.join(__dirname, '..', '..', '..', '..');
  await ensureChessPuzzlesSeeded(repoRoot);
}
