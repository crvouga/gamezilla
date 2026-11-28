import { expect, type Page, test } from '@playwright/test';

// regression: space-management-stories-document-examples
test('storybook integration: space management stories document the production components', async ({
  request,
}) => {
  const response = await request.get('/manifests/components.json');
  await expect(response).toBeOK();
  const manifest: unknown = await response.json();
  for (const [id, name, file] of [
    [
      'screens-spaces-members',
      'SpaceMemberRosterView',
      'space-member-roster-view',
    ],
    ['screens-spaces-share', 'SpaceSharingPanel', 'space-sharing-panel'],
    [
      'screens-spaces-remove-person',
      'SpaceManagementView',
      'space-management-view',
    ],
  ] as const) {
    expect(manifest).toMatchObject({
      components: {
        [id]: {
          reactComponentMeta: {
            exportName: name,
            filePath: expect.stringContaining(
              `/libs/spaces-client-ts/src/${file}.tsx`
            ),
          },
        },
      },
    });
  }
});

async function open(page: Page, id: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:light`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
}

// regression: storybook-screen-missing-product-navigation
test('storybook integration: the compact lobby keeps the production bottom tabs', async ({
  page,
}) => {
  await open(page, 'screens-spaces-home--populated', 390);
  await expect(
    page.getByRole('navigation', { name: 'Navigation' })
  ).toBeVisible();
  await expect(page.getByTestId('tab-spaces')).toBeVisible();
  await expect(page.getByTestId('tab-profile')).toBeVisible();
  await expect(page.locator('[data-region="rail"]')).toHaveCount(0);
});

// regression: storybook-sidebar-story-misses-initial-mount
test('storybook integration: screens-shell-header-island--sidebar-spaces-current renders the signed-in account in the desktop rail', async ({
  page,
}) => {
  await open(page, 'screens-shell-header-island--sidebar-spaces-current', 1440);
  const rail = page.locator('[data-region="rail"]');
  await expect(
    rail.getByRole('button', { name: '@avery, account menu' })
  ).toBeVisible();
});

for (const id of [
  'screens-spaces-home--populated',
  'screens-space-home--host-choosing',
]) {
  test(`storybook integration: ${id} keeps the production desktop sidebar`, async ({
    page,
  }) => {
    await open(page, id, 1440);
    const rail = page.locator('[data-region="rail"]');
    await expect(rail).toBeVisible();
    await expect(rail.getByTestId('tab-spaces')).toBeVisible();
    await expect(
      rail.getByRole('button', { name: '@avery, account menu' })
    ).toBeVisible();
    await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
  });
}

// regression: storybook-space-home-two-space-headers
test('storybook integration: screens-space-home--host-choosing has exactly one real compact space header', async ({
  page,
}) => {
  await open(page, 'screens-space-home--host-choosing', 390);
  // One top bar, which names the space on its home and is the space's alone:
  // the app's account menu stays outside a space.
  await expect(page.getByTestId('space-title')).toHaveCount(1);
  await expect(page.getByTestId('space-title')).toHaveText('Friday game night');
  const bar = page.locator('[data-space-row="actions"]');
  await expect(bar).toHaveCount(1);
  await expect(
    bar.getByRole('button', { name: 'Account menu', exact: true })
  ).toHaveCount(0);
  await expect(bar.getByTestId('space-name')).toHaveText('Friday game night');
  await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
});

test('storybook integration: a stack route keeps its header without bottom tabs', async ({
  page,
}) => {
  await open(page, 'screens-settings-sound--on', 390);
  await expect(page.getByRole('heading', { name: 'Sound' })).toBeVisible();
  await expect(page.locator('[data-component="AppTabBar"]')).toHaveCount(0);
});

// regression: space-menu-tooltip-obscures-choosing-heading
test('storybook integration: a focused Minimize button keeps the choosing heading clear on a phone', async ({
  page,
}) => {
  await open(page, 'space-choosing--screen', 390);
  await page.keyboard.press('Tab');
  const minimize = page.getByRole('button', { name: 'Minimize space' });
  await minimize.focus();
  await expect(minimize).toBeFocused();
  const tip = page.getByRole('tooltip').filter({ hasText: 'Minimize space' });
  await expect(tip).toBeVisible();
  const bubble = await tip.boundingBox();
  const heading = await page
    .getByRole('heading', { name: /is choosing a game/i })
    .boundingBox();
  if (!bubble || !heading) throw new Error('Missing tooltip or heading');
  expect(bubble.y + bubble.height).toBeLessThanOrEqual(heading.y);
});

const hostActions = [
  'People in this space',
  'Space settings',
  'End space',
  'Minimize space',
];
const guestActions = ['People in this space', 'Leave space', 'Minimize space'];

async function expectSpaceActions(
  page: Page,
  width: number,
  story: string,
  names: readonly string[]
): Promise<void> {
  await open(page, `screens-space-home--${story}`, width);
  const bar = page.locator('[data-space-row="actions"]');
  const buttons = bar.locator('[data-space-row="tools"] button');
  await expect(buttons).toHaveCount(names.length);
  const back = await bar.getByRole('button').first().boundingBox();
  if (!back) throw new Error('Missing Back button');
  let previousRight = back.x + back.width;
  for (const [index, name] of names.entries()) {
    const button = buttons.nth(index);
    await expect(button).toHaveAccessibleName(name);
    await expect(button).toBeInViewport({ ratio: 1 });
    const box = await button.boundingBox();
    if (!box) throw new Error(`Missing button: ${name}`);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(
      Math.abs(box.y + box.height / 2 - (back.y + back.height / 2))
    ).toBeLessThan(2);
    expect(box.x).toBeGreaterThanOrEqual(previousRight);
    previousRight = box.x + box.width;
  }
  const title = await bar.getByTestId('space-title').boundingBox();
  if (!title) throw new Error('Missing space title');
  if (width > 320) expect(title.width).toBeGreaterThan(1);
}

// regression: space-bar-actions-hidden
// regression: space-toolbar-wraps-on-phone
test('storybook integration: every host space action fits at 320px with a long title', async ({
  page,
}) => {
  await expectSpaceActions(page, 320, 'long-name', hostActions);
});

for (const width of [390, 1440]) {
  test(`storybook integration: every host space action fits at ${width}px with a long title`, async ({
    page,
  }) => {
    await expectSpaceActions(page, width, 'long-name', hostActions);
  });
}

for (const width of [320, 390, 1440]) {
  test(`storybook integration: every guest space action fits at ${width}px`, async ({
    page,
  }) => {
    await expectSpaceActions(page, width, 'guest-waiting', guestActions);
  });
}
