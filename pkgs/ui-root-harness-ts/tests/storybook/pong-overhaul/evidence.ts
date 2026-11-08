// @io-wall-ok — browser evidence adapter; all navigation stays on the test server.
import { expect, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';
import { contrastDiagnostic } from './contrast-diagnostic';

export async function openPong(page: Page, state: string, theme: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Storybook's highlight addon rescans every element's computed style on each
  // DOM change in the story; no player's page runs it, so it stays off here.
  await page.addInitScript(() => {
    (
      globalThis as { __STORYBOOK_HIGHLIGHT_INITIALIZED?: boolean }
    ).__STORYBOOK_HIGHLIGHT_INITIALIZED = true;
  });
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort()
  );
  await page.goto(
    `/iframe.html?id=screens-games-pong-court--${state}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
}

export async function recordPong(page: Page, info: TestInfo, name: string) {
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
  await page.addScriptTag({ content: axe.source });
  const audit = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: typeof axe }).axe.run(
      '#storybook-root'
    );
    return {
      violations: result.violations,
      incomplete: result.incomplete,
      passes: result.passes,
      inapplicable: result.inapplicable,
      testEnvironment: result.testEnvironment,
    };
  });
  await info.attach(`${name}-accessibility`, {
    body: JSON.stringify(audit, null, 2),
    contentType: 'application/json',
  });
  const unresolved = audit.incomplete.filter(
    (rule) => rule.id === 'color-contrast'
  );
  if (unresolved.length > 0) {
    const selectors = unresolved.flatMap((rule) =>
      rule.nodes.flatMap((node) =>
        node.target.filter(
          (target): target is string => typeof target === 'string'
        )
      )
    );
    await info.attach(`${name}-incomplete-contrast-context`, {
      body: JSON.stringify(await contrastDiagnostic(page, selectors), null, 2),
      contentType: 'application/json',
    });
  }
  expect(
    audit.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )
  ).toEqual([]);
}
