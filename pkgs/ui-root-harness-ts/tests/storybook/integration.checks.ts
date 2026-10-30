import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('storybook integration: project documentation replaces the setup checklist', async ({
  page,
}) => {
  await page.goto('/?path=/docs/start-here--docs');
  const docs = page.frameLocator('#storybook-preview-iframe');
  await expect(
    docs.getByRole('heading', { name: 'Gamezilla UI' })
  ).toBeVisible();
  await expect(
    docs.getByRole('heading', { name: 'Verify a change' })
  ).toBeVisible();
  await expect(
    docs.getByText('bun storybook:coverage', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Storybook basics', { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByRole('link', { name: 'Gamezilla UI' })).toBeVisible();
  await docs.getByRole('link', { name: 'Button', exact: true }).click();
  await expect(page).toHaveURL(
    /path=\/story\/components-inputs-button--interactive/
  );
});

// regression: storybook-button-title-json-control
test('storybook integration: Controls updates the production component', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-button--interactive');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  await expect(
    canvas.getByRole('button', { name: 'Save', exact: true })
  ).toBeVisible();
  await page.getByRole('tab', { name: /Controls/ }).click();
  const title = page.locator('#control-title');
  await expect(title).toHaveAttribute('placeholder', 'Edit string...');
  await title.fill('Publish puzzle');
  await title.blur();
  await expect(
    canvas.getByRole('button', { name: 'Publish puzzle' })
  ).toBeVisible();
  await expect(canvas.getByRole('button')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Viewport size', exact: true })
    .click();
  await page.getByText('Phone', { exact: true }).click();
  await expect(canvas.locator('html')).toHaveJSProperty('clientWidth', 390);
  await page
    .getByRole('button', { name: 'Production color scheme light' })
    .click();
  await page.getByText('dark', { exact: true }).click();
  await expect(
    canvas.locator('#storybook-root [data-theme="dark"]').first()
  ).toBeVisible();
  await expect(
    canvas.getByRole('button', { name: 'Publish puzzle' })
  ).toBeVisible();
});
