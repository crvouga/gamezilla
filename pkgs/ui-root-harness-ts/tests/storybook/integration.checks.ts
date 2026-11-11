import { expect, type Page, test } from '@playwright/test';
import { builderControlsUncovered } from './builder-control-visibility';

test.use({ viewport: { width: 1440, height: 900 } });

test('storybook integration: project documentation replaces the setup checklist', async ({
  page,
}) => {
  await page.goto('/?path=/docs/start-here--docs');
  const docs = page.frameLocator('#storybook-preview-iframe');
  await expect(
    docs.getByRole('heading', { name: 'Design system' })
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
  await expect(page.getByRole('link', { name: 'Design system' })).toBeVisible();
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

// regression: builder-publish-strip-clips-stage — the publish step was a
// strip pinned under the scroll area, so in the first view of the pack
// builder "Create puzzle in this pack" was cut in half by it, and on a
// phone the strip hid the Sokoban board. Publishing is now a screen of its
// own: nothing is ever pinned over the board's.
for (const story of [
  'screens-puzzles-content-author-board--pack',
  'screens-games-sokoban-editor--two-crates',
])
  for (const size of [
    { width: 390, height: 791 },
    { width: 1200, height: 884 },
  ])
    test(`storybook integration: ${story} at ${size.width}px keeps its stage uncovered`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(
        `/iframe.html?id=${story}&viewMode=story&globals=theme:dark`
      );
      await expect
        .poll(() =>
          page.locator('#storybook-root').getAttribute('data-story-ready')
        )
        .toBe('true');
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(builderControlsUncovered)).toEqual([]);
    });

/**
 * On a phone's first screen of the builder's board: the stage's first row
 * (the board's first squares, the pack's first puzzle) is wholly in view,
 * and the screen holds the board alone: publishing and the next action are
 * screens of their own, so neither can come before or over it.
 */
async function builderPhoneFirstScreen(page: Page) {
  return await page.evaluate(() => {
    const first = document.querySelector(
      '[data-testid="content-author-stage"] :is([data-testid^="sokoban-square-"], [data-testid^="content-pack-item-"])'
    );
    if (first === null) return ['the first row is missing'];
    const found: string[] = [];
    const row = first.getBoundingClientRect();
    if (row.top < 0 || row.bottom > window.innerHeight)
      found.push('the first row is not wholly in the first screen');
    if (document.querySelector('[data-testid="content-author-publish"]'))
      found.push("the publish step shares the board's screen");
    if (document.querySelector('[data-component="ScreenIntroActions"]'))
      found.push("a next action sits in the board's title row");
    return found;
  });
}

// regression: builder-phone-publish-card-buries-stage — on a phone the
// unnumbered "Check and publish" card sat between "1 · Details" and
// "2 · Board", so the board (or the pack's puzzle list) started under the
// fold and the steps read out of order. The board is now a screen of its
// own, reached from the builder's hub of steps.
for (const story of [
  'screens-puzzles-content-author-board--pack',
  'screens-games-sokoban-editor--two-crates',
])
  test(`storybook integration: ${story} on a phone shows its first row in the board's first screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 791 });
    await page.goto(
      `/iframe.html?id=${story}&viewMode=story&globals=theme:dark`
    );
    await expect
      .poll(() =>
        page.locator('#storybook-root').getAttribute('data-story-ready')
      )
      .toBe('true');
    await page.evaluate(() => document.fonts.ready);
    expect(await builderPhoneFirstScreen(page)).toEqual([]);
  });

// regression: storybook-sidebar-compact-viewport
// regression: storybook-header-compact-viewport
test('storybook integration: wide header and sidebar entries declare desktop eligibility while compact tabs remain covered', async ({
  request,
}) => {
  const response = await request.get('/index.json');
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as {
    entries: Record<string, { tags: string[] }>;
  };
  for (const name of [
    'sidebar-spaces-current',
    'sidebar-search-current',
    'sidebar-notifications-current',
    'sidebar-profile-current',
    'sidebar-none-current',
    'spaces-current',
    'search-current',
    'notifications-current',
    'profile-current',
    'long-labels',
    'select-profile',
    'with-account-menu',
  ]) {
    const entry = index.entries[`screens-shell-header-island--${name}`];
    expect(entry).toBeDefined();
    expect(entry?.tags).toContain('viewport-desktop');
  }
  for (const name of ['spaces-current', 'select-search', 'long-labels']) {
    const entry = index.entries[`screens-shell-tab-bar--${name}`];
    expect(entry).toBeDefined();
    expect(entry?.tags).not.toContain('viewport-desktop');
  }
});

// regression: storybook-builder-scrollport-observation
test('storybook integration: pack 390 and Sokoban 1200 controls remain reachable inside the scrollport', async ({
  page,
}) => {
  for (const [story, width, height] of [
    ['screens-puzzles-content-author-board--pack', 390, 791],
    ['screens-games-sokoban-editor--two-crates', 1200, 884],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(
      `/iframe.html?id=${story}&viewMode=story&globals=theme:dark`
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(builderControlsUncovered)).toEqual([]);
  }
});

// regression: storybook-header-responsive-observation
test('storybook integration: compact tab counterpart selects Search at 390 and 768', async ({
  page,
}) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      '/iframe.html?id=screens-shell-tab-bar--select-search&viewMode=story'
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-status',
      'success'
    );
    await expect(
      page.getByRole('button', { name: 'Search', exact: true })
    ).toBeVisible();
  }
});

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({
    path: testInfo.outputPath('actual.png'),
    fullPage: true,
  });
});
