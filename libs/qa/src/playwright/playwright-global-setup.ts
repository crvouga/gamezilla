import { assertPlaywrightPreviewEnvReady } from './playwright-preview-env';

export default async function globalSetup(): Promise<void> {
  assertPlaywrightPreviewEnvReady();
}
