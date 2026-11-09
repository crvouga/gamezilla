// @io-wall-ok — static browser regression and capture adapter.
import { expect, type Page, test } from '@playwright/test';

async function open(page: Page, id: string, theme: string) {
  await page.goto(
    `/iframe.html?id=${id}--states&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

// regression: gallery-account-person-glyph
test('storybook integration: round18 account placeholders', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    for (const id of [
      'components-inputs-overflowmenubutton',
      'components-inputs-iconbutton',
    ]) {
      await open(page, id, theme);
      const buttons = page.getByRole('button', { name: /^Account( menu)?$/ });
      expect(await buttons.count()).toBeGreaterThan(0);
      for (const button of await buttons.all()) {
        await expect(button.locator('svg')).toBeVisible();
        const face = await button.locator('svg').evaluate((element) => ({
          fill: getComputedStyle(element).fill,
          stroke: getComputedStyle(element).stroke,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }));
        expect(face.fill).not.toBe('none');
        expect(face.stroke).toBe('none');
        expect(face.width).toBeGreaterThan(0);
        expect(face.width).toBe(face.height);
      }
    }
  }
});

// regression: badged-icon-stretched-parent
test('storybook integration: round18 badge attached', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await open(page, 'primitives-badgedicon', theme);
    const badge = page
      .getByText('Destructive intent', { exact: true })
      .locator('..')
      .locator(':scope > span');
    const iconBox = await badge.locator('svg').boundingBox();
    const markBox = await badge
      .getByText('1', { exact: true })
      .locator('..')
      .boundingBox();
    expect(iconBox).not.toBeNull();
    expect(markBox).not.toBeNull();
    if (!iconBox || !markBox) throw new Error('Missing mail or unread count');
    expect(markBox.x).toBeLessThan(iconBox.x + iconBox.width);
    expect(markBox.x + markBox.width).toBeLessThanOrEqual(
      iconBox.x + iconBox.width + 12
    );
    expect(Math.abs(markBox.y - iconBox.y)).toBeLessThanOrEqual(4);
  }
});

// regression: gallery-on-primary-without-fill
test('storybook integration: round18 primary backing', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    for (const primitive of ['icon', 'sparkline', 'text']) {
      await open(page, `primitives-${primitive}`, theme);
      const samples =
        primitive === 'icon'
          ? page
              .getByText('on-primary', { exact: true })
              .locator('..')
              .locator('svg')
          : page.locator('.text-on-primary');
      expect(await samples.count()).toBeGreaterThan(0);
      for (const sample of await samples.all()) {
        const ratio = await sample.evaluate((element) => {
          const luminance = (color: string) => {
            const channels = (color.match(/[\d.]+/g) ?? [])
              .slice(0, 3)
              .map(Number)
              .map((v) => {
                const n = v / 255;
                return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
              });
            return (
              (channels[0] ?? 0) * 0.2126 +
              (channels[1] ?? 0) * 0.7152 +
              (channels[2] ?? 0) * 0.0722
            );
          };
          let node: Element | null = element;
          while (
            node &&
            getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)'
          )
            node = node.parentElement;
          if (!node) throw new Error('Missing painted background');
          const a = luminance(
            element.hasAttribute('stroke')
              ? getComputedStyle(element).stroke
              : getComputedStyle(element).color
          );
          const b = luminance(getComputedStyle(node).backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        expect(ratio).toBeGreaterThanOrEqual(primitive === 'text' ? 4.5 : 3);
      }
    }
  }
});

// regression: gallery-round-images-clipped
test('storybook integration: round18 round images contained', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await open(page, 'primitives-image', theme);
    const images = page.getByRole('img', { name: /^Picture, (sm|md|lg)$/ });
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      const box = await image.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error('Missing round image');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  }
});

// regression: gallery-image-invisible-artwork
test('storybook integration: round18 image artwork opaque', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await open(page, 'primitives-image', theme);
    const colors = await page
      .getByRole('img', { name: 'A wide picture', exact: true })
      .evaluate((element) => {
        const image = element as HTMLImageElement;
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 3;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Missing canvas');
        ctx.drawImage(image, 0, 0, 4, 3);
        return [...ctx.getImageData(0, 0, 4, 3).data];
      });
    expect(colors[3]).toBe(255);
    expect(colors.slice(0, 3)).not.toEqual(colors.slice(20, 23));
  }
});

// regression: social-sign-in-loading-gallery-idle
test('storybook integration: round18 sign in visibly loading', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await open(page, 'components-inputs-socialsigninbutton', theme);
    const button = page
      .getByText('Loading state', { exact: true })
      .locator('..')
      .getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button.locator('svg')).toBeVisible();
    await expect(button).toHaveAttribute('aria-busy', 'true');
  }
});
