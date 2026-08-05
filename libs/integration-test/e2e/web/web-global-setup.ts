import { clerkSetup } from '@clerk/testing/playwright';

import { resolveGamezillaRepoRoot } from '../../src/browser-artifact-paths';
import { applyClerkPlaywrightEnv } from '../../src/clerk-env';
import { resolveLocalPreviewApiOriginSync } from '../../src/local-api-preview';
import {
  DEV_CLIENT_BASE_URL,
  waitForLocalE2eStack,
} from '../../src/local-e2e-stack';
import {
  applyBrowserPreviewEnv,
  assertBrowserPreviewEnvReady,
} from '../../src/preview-env';
import { ensureChessPuzzlesSeeded } from '../setup/ensure-chess-puzzles-seeded';

/** One-time setup before bun-test web targets run. */
export async function webGlobalSetup(): Promise<void> {
  const localApiPreviewOrigin = resolveLocalPreviewApiOriginSync();
  applyBrowserPreviewEnv({
    baseURL: DEV_CLIENT_BASE_URL,
    localApiPreviewOrigin,
  });
  await waitForLocalE2eStack();
  assertBrowserPreviewEnvReady();
  applyClerkPlaywrightEnv();
  await clerkSetup();
  const repoRoot = resolveGamezillaRepoRoot(__dirname);
  await ensureChessPuzzlesSeeded(repoRoot);
}
