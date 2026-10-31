import { expect, type Locator, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

async function surfaceColor(field: Locator): Promise<string> {
  return field.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.color =
      getComputedStyle(element).getPropertyValue('--ui-color-surface');
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

async function hasPaintedPixels(overlay: Locator): Promise<boolean> {
  return overlay.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) return false;
    const context = element.getContext('2d');
    if (!context) return false;
    const pixels = context.getImageData(
      0,
      0,
      element.width,
      element.height
    ).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
}

// regression: storybook-background-controls-obscured
test('storybook integration: token backgrounds and grid preserve component state', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-textinput--controlled');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  const field = canvas.getByRole('textbox', { name: 'Name' });
  await field.fill('Keep this draft');
  await page
    .getByRole('button', { name: 'Preview background Canvas', exact: true })
    .click();
  await page
    .getByLabel('Preview background', { exact: true })
    .getByText('Surface', { exact: true })
    .click();
  await expect(canvas.locator('body')).toHaveCSS(
    'background-color',
    await surfaceColor(field)
  );
  await expect(canvas.locator('body')).toHaveCSS('background-image', 'none');
  await page
    .getByRole('switch', { name: 'Grid visibility', exact: true })
    .click();
  await expect(
    page.getByRole('switch', { name: 'Grid visibility', exact: true })
  ).toBeChecked();
  await expect(canvas.locator('body')).toHaveCSS(
    'background-image',
    /linear-gradient/
  );
  await expect(canvas.locator('body')).toHaveCSS(
    'background-size',
    '16px 16px, 16px 16px, 4px 4px, 4px 4px'
  );
  await page
    .getByRole('button', { name: 'Production color scheme light' })
    .click();
  await page.getByText('dark', { exact: true }).click();
  await expect(
    canvas.locator('[data-component="ThemeProvider"]').first()
  ).toHaveAttribute('data-theme', 'dark');
  await expect(field).toHaveValue('Keep this draft');
  await expect(canvas.locator('body')).toHaveCSS(
    'background-color',
    await surfaceColor(field)
  );
  await expect(
    canvas.locator('[data-component="ThemeProvider"]').first()
  ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page
    .getByRole('switch', { name: 'Grid visibility', exact: true })
    .click();
  await expect(canvas.locator('body')).toHaveCSS('background-image', 'none');
  await expect(field).toHaveValue('Keep this draft');
});

test('storybook integration: native Measure paints hovered component dimensions', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-button--interactive');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  const button = canvas.getByRole('button', { name: 'Save', exact: true });
  await expect(button).toBeVisible();
  const tool = page.getByRole('switch', { name: 'Measure tool', exact: true });
  await expect(tool).not.toBeChecked();
  await tool.click();
  await expect(tool).toBeChecked();
  // Storybook 10.6 paints measurements into this canvas without an ARIA role.
  const overlay = canvas.locator('canvas#storybook-addon-measure');
  await expect(overlay).toBeVisible();
  await button.hover();
  await expect.poll(() => hasPaintedPixels(overlay)).toBe(true);
  await tool.click();
  await expect(tool).not.toBeChecked();
  await expect(overlay).toHaveCount(0);
});

test('storybook integration: native Outline affects components and viewport rotates', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-button--interactive');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  const host = canvas.locator('[data-component="ThemeProvider"]').first();
  await expect(host).toBeVisible();
  const tool = page.getByRole('switch', { name: 'Outline tool', exact: true });
  await expect(tool).not.toBeChecked();
  await expect(host).toHaveCSS('outline-style', 'none');
  await tool.click();
  await expect(tool).toBeChecked();
  await expect(host).toHaveCSS('outline-style', 'solid');
  await expect(host).toHaveCSS('outline-width', '1px');
  await tool.click();
  await expect(tool).not.toBeChecked();
  await expect(host).toHaveCSS('outline-style', 'none');
  await page
    .getByRole('button', { name: 'Viewport size', exact: true })
    .click();
  await page.getByText('Phone', { exact: true }).click();
  await expect(canvas.locator('html')).toHaveJSProperty('clientWidth', 390);
  await page.getByRole('button', { name: /Rotate viewport/ }).click();
  await expect(canvas.locator('html')).toHaveJSProperty('clientWidth', 844);
  await expect(canvas.locator('html')).toHaveJSProperty('clientHeight', 390);
});

test('storybook integration: inherited Button args log native Actions', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-button--interactive');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  await canvas.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('tab', { name: /Actions/ }).click();
  await expect(
    page
      .getByRole('tabpanel', { name: /Actions/ })
      .getByText('onClick', { exact: true })
  ).toBeVisible();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await page.locator('#control-title').fill('Publish');
  await page.locator('#control-title').blur();
  await expect(
    canvas.getByRole('button', { name: 'Publish', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: /Reset controls/ }).click();
  await expect(
    canvas.getByRole('button', { name: 'Save', exact: true })
  ).toBeVisible();
});

test('storybook integration: custom composition args replace demo configuration widgets', async ({
  page,
}) => {
  await page.goto('/?path=/story/product-game-arena--states');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  const column = canvas.getByRole('button', {
    name: 'Column 2, 0 discs',
    exact: true,
  });
  await column.click();
  const occupied = canvas.getByRole('button', {
    name: 'Column 2, 1 discs',
    exact: true,
  });
  await expect(occupied).toHaveAttribute('aria-disabled', 'false');
  await page.getByRole('tab', { name: /Controls/ }).click();
  await page.locator('label[for="control-boardInteractive"]').click();
  await expect(occupied).toHaveAttribute('aria-disabled', 'true');
  await expect(occupied).toBeVisible();
  await page.locator('label[for="control-boardInteractive"]').click();
  await expect(occupied).toHaveAttribute('aria-disabled', 'false');
  await expect(
    canvas.getByRole('button', { name: 'Toggle board controls' })
  ).toHaveCount(0);
});

// regression: storybook-spy-cleared-during-args-play
test('storybook integration: controlled play retains callback history across args updates', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=components-inputs-switch--toggle&viewMode=story'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-status',
    'success'
  );
  await expect(
    page.getByRole('switch', { name: 'Notifications' })
  ).not.toBeChecked();
});

// regression: storybook-a11y-manual-setting-ignored
test('storybook integration: native accessibility inspection leaves automated axe to the browser suite', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-button--interactive');
  await page.getByRole('tab', { name: /Accessibility/ }).click();
  await expect(
    page.getByRole('button', { name: 'Run accessibility scan', exact: true })
  ).toBeVisible();
});

// regression: storybook-gallery-play-ambiguous-theme-target
test('storybook integration: gallery plays scope their targets to both theme panes', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=product-game-frame-play--states&viewMode=story'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-status',
    'success'
  );
  const walls = page.getByRole('button', {
    name: 'Horizontal wall',
    exact: true,
  });
  await expect(walls).toHaveCount(2);
  await expect(walls.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(walls.nth(1)).toHaveAttribute('aria-pressed', 'false');
});
