// @io-wall-ok
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { wallIo } from '@pkgs/io';
import { createDriver } from '@pkgs/ui-testing';
import { type Browser, chromium, devices, type Page } from '@playwright/test';

import {
  browserArtifactDir,
  resolveGamezillaRepoRoot,
} from '../../src/browser-artifact-paths';
import { DEV_CLIENT_BASE_URL } from '../../src/local-e2e-stack';

import type { TestApp } from '../support/test-app';
import { createBetterAuthE2eAdapter } from './better-auth-adapter';

const io = wallIo();

export type WithWebAppOptions = {
  /** Path opened on launch (default `/`). */
  path?: string;
};

/**
 * Launches Chromium, builds a {@link TestApp} over PlaywrightDriver + Better Auth,
 * runs `fn`, screenshots on failure, then tears down.
 */
export async function withWebApp(
  fn: (app: TestApp) => Promise<void>,
  options: WithWebAppOptions = {}
): Promise<void> {
  const headed = process.env['HEADED'] === '1';
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    baseURL: DEV_CLIENT_BASE_URL,
  });
  const page = await context.newPage();
  const launchPath = options.path ?? '/';
  const driver = createDriver({
    kind: 'playwright',
    page,
    baseUrl: new URL(launchPath, DEV_CLIENT_BASE_URL).href,
  });
  const app: TestApp = {
    driver,
    auth: createBetterAuthE2eAdapter(page, driver),
    open: async (appPath) => {
      await page.goto(appPath);
    },
  };

  try {
    await driver.launch();
    await fn(app);
  } catch (error) {
    await captureFailureScreenshot(page, browser);
    throw error;
  } finally {
    await driver.close();
    await context.close();
    await browser.close();
  }
}

async function captureFailureScreenshot(
  page: Page,
  _browser: Browser
): Promise<void> {
  try {
    const repoRoot = resolveGamezillaRepoRoot(__dirname);
    const dir = browserArtifactDir(repoRoot);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `failure-${String(io.clock.now())}.png`);
    await page.screenshot({ path: file, fullPage: true });
    process.stderr.write(`[e2e] screenshot: ${file}\n`);
  } catch (screenshotError) {
    process.stderr.write(
      `[e2e] screenshot failed: ${String(screenshotError)}\n`
    );
  }
}
