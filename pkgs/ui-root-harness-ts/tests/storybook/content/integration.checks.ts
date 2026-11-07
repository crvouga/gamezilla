import { expect, type Locator, type Page, test } from '@playwright/test';

async function open(page: Page, story: string, width: number, theme: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function textBounds(label: Locator) {
  return label.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    const clippedBy: string[] = [];
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (!['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX))
        continue;
      const box = parent.getBoundingClientRect();
      if (text.left < box.left || text.right > box.right)
        clippedBy.push(parent.tagName);
    }
    return clippedBy;
  });
}

for (const width of [390, 768, 1440])
  for (const theme of ['light', 'dark']) {
    // regression: account-connect-error-label-clipped
    for (const story of [
      'screens-games-matchmaking--choose-time-control',
      'screens-billing--checkout-provider-unavailable',
    ])
      test(`storybook integration: feedback remains readable in ${story} at ${width}/${theme}`, async ({
        page,
      }) => {
        await open(page, story, width, theme);
        const feedback = page.locator(
          'button[data-phase="success"], button[data-phase="error"]'
        );
        await expect(feedback).toHaveCount(1);
        const label = feedback.locator('p:not([aria-hidden="true"] p)');
        await expect(label).toBeVisible();
        expect(await textBounds(label)).toEqual([]);
      });

    // regression: account-connect-error-label-clipped
    test(`storybook integration: account retry label stays readable at ${width}/${theme}`, async ({
      page,
    }) => {
      await assertAccountRetry(page, width, theme);
    });

    // regression: friend-long-name-escapes-profile
    test(`storybook integration: a long friend name stays inside its profile at ${width}/${theme}`, async ({
      page,
    }) => {
      await assertFriendName(page, width, theme);
    });
  }

// regression: account-connect-error-label-clipped
for (const sample of [
  { story: 'loading', label: 'Saving…' },
  { story: 'success', label: 'Saved' },
  { story: 'retry', label: 'Could not save' },
])
  test(`storybook integration: ${sample.story} feedback fits beyond the shorter idle label`, async ({
    page,
  }) => {
    await open(page, `components-inputs-button--${sample.story}`, 390, 'light');
    const label = page
      .locator('button p:not([aria-hidden="true"] p)')
      .filter({ hasText: sample.label });
    await expect(label).toBeVisible();
    expect(await textBounds(label)).toEqual([]);
    const box = await page.getByRole('button').boundingBox();
    expect(box).not.toBeNull();
    if (box === null) throw new Error('Feedback button is missing');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

// regression: friend-long-name-escapes-profile
for (const width of [390, 768, 1440])
  test(`storybook integration: one-line inline text keeps a constrained box at ${width}`, async ({
    page,
  }) => {
    await open(page, 'primitives-text--single-line', width, 'light');
    for (const id of [
      'clamped-text',
      'clamped-inherited-text',
      'clamped-strong',
    ]) {
      const text = page.getByTestId(id);
      await expect(text).toHaveText(
        'a_really_long_username_that_keeps_going_and_going'.repeat(8)
      );
      const geometry = await text.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const parent = element.parentElement?.getBoundingClientRect();
        return {
          clipped: element.scrollWidth > element.clientWidth,
          overflow: style.overflowX,
          ellipsis: style.textOverflow,
          oneLine: box.height <= Number.parseFloat(style.lineHeight) + 1,
          contained:
            parent !== undefined &&
            box.left >= parent.left &&
            box.right <= parent.right,
        };
      });
      expect(geometry).toEqual({
        clipped: true,
        overflow: 'hidden',
        ellipsis: 'ellipsis',
        oneLine: true,
        contained: true,
      });
    }
    await expect(page.getByTestId('unclamped-inline-text')).toHaveCSS(
      'display',
      'inline'
    );
  });

// regression: synthetic-population-initial-state-fixture-saveable
for (const state of ['loading', 'failed'])
  test(`storybook integration: initial ${state} cannot save unknown configuration`, async ({
    page,
  }) => {
    await open(
      page,
      `screens-admin-synthetic-population--${state}`,
      390,
      'light'
    );
    await expect(
      page.getByRole('button', {
        name: 'Save synthetic population',
        exact: true,
      })
    ).toBeDisabled();
  });

// regression: connect-four-finished-fixture-missing-record
for (const state of ['won', 'lost', 'full-board-draw'])
  test(`storybook integration: ${state} board retains its move record`, async ({
    page,
  }) => {
    await open(
      page,
      `screens-games-connect-four-board--${state}`,
      390,
      'light'
    );
    await expect(page.getByText('No moves yet.', { exact: true })).toHaveCount(
      0
    );
    await expect(
      page.getByTestId('custom-game-move-strip-place')
    ).toBeVisible();
  });

// regression: connect-four-finished-fixture-missing-record
test('storybook integration: literal won Connect Four retains its move record', async ({
  page,
}) => {
  await open(page, 'screens-games-connect-four-board--won', 390, 'light');
  await expect(page.getByText('No moves yet.', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('custom-game-move-strip-place')).toBeVisible();
});

async function assertAccountRetry(page: Page, width: number, theme: string) {
  await open(page, 'screens-account--connect-failed', width, theme);
  const retry = page.getByTestId('account-link-provider-apple');
  await expect(retry).toBeVisible();
  await expect(page.getByRole('alert')).toContainText("Couldn't reach Apple");
  const label = retry.locator('p:not([aria-hidden="true"] p)');
  expect(await textBounds(label)).toEqual([]);
  await expect(retry).toHaveAccessibleName('Try again');
}

// regression: account-connect-error-label-clipped
test('storybook integration: literal account retry label stays readable on a light phone', async ({
  page,
}) => {
  await assertAccountRetry(page, 390, 'light');
});

async function assertFriendName(page: Page, width: number, theme: string) {
  await open(page, 'screens-friends-user--long-name', width, theme);
  const name = page.getByTestId('friend-user-username');
  await expect(name).toHaveText('@wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww');
  const headings = page.getByRole('heading');
  const failures = await headings.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const fits = rect.left >= 0 && rect.right <= innerWidth;
      const overflowIsReadable =
        element.scrollWidth <= element.clientWidth ||
        (style.overflowX === 'hidden' && style.textOverflow === 'ellipsis');
      return fits && overflowIsReadable ? [] : [element.textContent];
    })
  );
  expect(failures).toEqual([]);
  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  const block = await page
    .getByRole('button', { name: 'Block', exact: true })
    .boundingBox();
  expect(title).not.toBeNull();
  expect(block).not.toBeNull();
  if (title === null || block === null)
    throw new Error('Profile header controls are missing');
  const headerGeometry = await page
    .locator('header')
    .first()
    .evaluate((header) =>
      Array.from(
        header.querySelectorAll(
          '[data-component="ActionBar"], [data-component="ActionBar"] > div, h1, button'
        )
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return {
          name: element.getAttribute('aria-label') ?? element.textContent,
          component: element.getAttribute('data-component'),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          minWidth: css.minWidth,
          shrink: css.flexShrink,
        };
      })
    );
  expect(
    title.x + title.width,
    JSON.stringify(headerGeometry)
  ).toBeLessThanOrEqual(block.x);
}

// regression: friend-long-name-escapes-profile
test('storybook integration: literal a long friend name stays inside its profile on a light phone', async ({
  page,
}) => {
  await assertFriendName(page, 390, 'light');
});

// regression: synthetic-population-initial-state-fixture-saveable
test('storybook integration: literal initial loading cannot save unknown configuration', async ({
  page,
}) => {
  await open(page, 'screens-admin-synthetic-population--loading', 390, 'light');
  await expect(
    page.getByRole('button', {
      name: 'Save synthetic population',
      exact: true,
    })
  ).toBeDisabled();
});

// regression: friend-profile-unavailable-recovery-missing
test('storybook integration: a deleted profile has a readable heading and direct Friends recovery', async ({
  page,
}) => {
  await open(page, 'screens-friends-user--deleted', 390, 'light');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Account deleted' })
  ).toBeVisible();
  await expect(page.getByText(/morgan|5a1e0000/i)).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Return to Friends' })
  ).toHaveAttribute('href', '/profile/friends');
  await expect(page.getByRole('button', { name: 'Add friend' })).toHaveCount(0);
});
