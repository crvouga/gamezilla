// @io-wall-ok — first-document fixtures read from the production sources.
import { readFile } from 'node:fs/promises';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';
import { expect, type Page, test } from '@playwright/test';

async function geometry(page: Page) {
  return page.locator('[data-startup-shell]').evaluate((shell) => {
    const selectors = [
      'h1',
      'nav',
      'nav a',
      '[data-startup-create]',
      '[role="status"]',
    ];
    return selectors.map((selector) => {
      const element = shell.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        selector,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        size: style.fontSize,
        weight: style.fontWeight,
        leading: style.lineHeight,
      };
    });
  });
}

// regression: startup-reset-and-action-shift
for (const width of [390, 768, 844, 1440]) {
  test(`storybook integration: opening layout survives stylesheet arrival at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(
      '/iframe.html?id=screens-spaces-home--empty&viewMode=story&globals=theme:dark'
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await page.evaluate(() => document.fonts.ready);
    const css = withDocumentPalette(
      await readFile(
        new URL(
          '../../../../ui-root-client-ts/src/browser-opening.css',
          import.meta.url
        ),
        'utf8'
      )
    );
    const html = await readFile(
      new URL(
        '../../../../../libs/app-root-client-ts/src/browser-opening.html',
        import.meta.url
      ),
      'utf8'
    );
    await page.evaluate(
      ({ css, html }) => {
        // Hold font registration constant: this regression isolates the CSS reset.
        const faces = Array.from(document.styleSheets).flatMap((sheet) =>
          Array.from(sheet.cssRules)
            .filter((rule) => rule instanceof CSSFontFaceRule)
            .map((rule) => rule.cssText)
        );
        for (const sheet of document.styleSheets) sheet.disabled = true;
        const fonts = document.createElement('style');
        fonts.textContent = faces.join('\n');
        document.head.append(fonts);
        const style = document.createElement('style');
        style.dataset['openingStyle'] = '';
        style.textContent = css;
        document.head.append(style);
        const fragment = new DOMParser().parseFromString(html, 'text/html');
        const opening = fragment.querySelector('[data-startup-shell]');
        if (!opening) throw new Error('Missing production opening document');
        const title = opening.querySelector('h1');
        const lobby = opening.querySelector<HTMLElement>('[data-route="/"]');
        const tab = opening.querySelector('nav a');
        if (!title || !lobby || !tab)
          throw new Error('Incomplete opening document');
        title.textContent = 'Spaces';
        lobby.hidden = false;
        tab.setAttribute('aria-current', 'page');
        document.body.append(document.importNode(opening, true));
      },
      { css, html }
    );
    const first = await geometry(page);
    await page.evaluate(() => {
      for (const sheet of document.styleSheets) sheet.disabled = false;
    });
    expect(await geometry(page)).toEqual(first);
    if (width < 1024) {
      const openingButton = await page
        .locator('[data-startup-create]')
        .boundingBox();
      const liveButton = await page
        .locator('#storybook-root [data-testid="space-create"]')
        .boundingBox();
      expect(openingButton).not.toBeNull();
      expect(liveButton).not.toBeNull();
      if (!openingButton || !liveButton)
        throw new Error('Missing action geometry');
      expect(openingButton.y).toBe(liveButton.y);
      expect(openingButton.height).toBe(liveButton.height);
      expect(openingButton.x + openingButton.width).toBe(
        liveButton.x + liveButton.width
      );
    }
    await info.attach('opening-layout', {
      body: JSON.stringify(first),
      contentType: 'application/json',
    });
  });
}
