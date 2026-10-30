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

test('storybook integration: controlled input synchronizes canvas and Controls', async ({
  page,
}) => {
  await page.goto('/?path=/story/components-inputs-textinput--controlled');
  const canvas = page.frameLocator('#storybook-preview-iframe');
  const field = canvas.getByRole('textbox', { name: 'Name' });
  await expect(field).toBeVisible();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await field.fill('Alex');
  const value = page.locator('#control-value');
  await expect(value).toHaveValue('Alex');
  await value.fill('Sam');
  await value.blur();
  await expect(field).toHaveValue('Sam');
  await expect(canvas.getByRole('textbox')).toHaveCount(1);
});

test('storybook integration: Autodocs exposes production purpose and prop descriptions', async ({
  page,
}) => {
  await page.goto('/?path=/docs/components-inputs-button--docs');
  const docs = page.frameLocator('#storybook-preview-iframe');
  await expect(
    docs.getByText(/Run an action in the current view, such as saving a form/)
  ).toBeVisible();
  await expect(
    docs
      .getByRole('row')
      .filter({ hasText: 'Visible action label; prefer a verb' })
  ).toBeVisible();
  await expect(
    docs
      .getByRole('row')
      .filter({ hasText: 'Runs the action. Use a Link for navigation' })
  ).toBeVisible();
});

test('storybook integration: native banner Controls update the portal and visibility', async ({
  page,
}) => {
  await page.goto(
    '/?path=/story/components-feedback-dismissiblebanner--interactive'
  );
  const canvas = page.frameLocator('#storybook-preview-iframe');
  await expect(canvas.getByText('A new version is ready')).toBeVisible();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await page.getByRole('radio', { name: 'bottom', exact: true }).check();
  const bottom = canvas.locator(
    '[data-component="DismissibleBannerPortalHost"][data-position="bottom"]'
  );
  await expect(bottom.getByText('A new version is ready')).toBeVisible();
  await canvas.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(canvas.getByText('A new version is ready')).toHaveCount(0);
  // Reopen through the same native boolean control after the canvas updates args.
  await expect(
    page.getByRole('switch', { name: 'visible', exact: true })
  ).not.toBeChecked();
  await page.locator('label[for="control-visible"]').click();
  await expect(
    page.getByRole('switch', { name: 'visible', exact: true })
  ).toBeChecked();
  await expect(bottom.getByText('A new version is ready')).toBeVisible();
});
