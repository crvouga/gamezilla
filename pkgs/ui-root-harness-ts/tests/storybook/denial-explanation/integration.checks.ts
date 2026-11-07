import { expect, test } from '@playwright/test';

// regression: denial-only-explanation-truncated
test('storybook integration: the complete multiplayer refusal fits at 320 pixels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(
    '/iframe.html?id=screens-permissions-denial-modal--without-way-forward&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  const dialog = page.getByRole('dialog', {
    name: 'Finish your current multiplayer game first',
    exact: true,
  });
  const heading = dialog.getByRole('heading', {
    name: 'Finish your current multiplayer game first',
    exact: true,
  });
  await expect(heading).toBeVisible();
  expect(
    await heading.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      return (
        element.scrollWidth <= element.clientWidth &&
        element.scrollHeight <= element.clientHeight &&
        box.left >= 0 &&
        box.right <= innerWidth &&
        Array.from(range.getClientRects()).every(
          (line) =>
            line.left >= box.left &&
            line.right <= box.right &&
            line.top >= box.top &&
            line.bottom <= box.bottom
        )
      );
    })
  ).toBe(true);
  await expect(
    dialog.getByRole('button', { name: 'OK', exact: true })
  ).toBeEnabled();
  await expect(dialog.getByTestId('permission-denial-action')).toHaveCount(0);
});

const examples = [
  {
    story: 'without-way-forward',
    title: 'Finish your current multiplayer game first',
    buttons: ['OK'],
  },
  {
    story: 'with-way-forward',
    title: 'Get Plus to host more spaces',
    buttons: ['See plans', 'Not now'],
  },
  {
    story: 'quota-reset',
    title: "You've used this for now",
    buttons: ['Sign in', 'Not now'],
  },
];

for (const width of [320, 390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const sample of examples) {
      // regression: denial-only-explanation-truncated
      test(`storybook integration: denial ${sample.story} explains itself at ${width} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(
          `/iframe.html?id=screens-permissions-denial-modal--${sample.story}&viewMode=story&globals=theme:${theme}`
        );
        await expect(page.locator('#storybook-root')).toHaveAttribute(
          'data-story-ready',
          'true'
        );
        await page.evaluate(() => document.fonts.ready);
        const dialog = page.getByRole('dialog', {
          name: sample.title,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        const heading = dialog.getByRole('heading', {
          name: sample.title,
          exact: true,
        });
        const geometry = await heading.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const lines = Array.from(range.getClientRects());
          return {
            allTextInside:
              lines.length > 0 &&
              lines.every(
                (line) =>
                  line.left >= bounds.left &&
                  line.right <= bounds.right &&
                  line.top >= bounds.top &&
                  line.bottom <= bounds.bottom
              ),
            noOverflow:
              element.scrollHeight <= element.clientHeight &&
              element.scrollWidth <= element.clientWidth,
            withinViewport:
              bounds.left >= 0 &&
              bounds.right <= window.innerWidth &&
              bounds.top >= 0 &&
              bounds.bottom <= window.innerHeight,
          };
        });
        expect(geometry).toEqual({
          allTextInside: true,
          noOverflow: true,
          withinViewport: true,
        });
        for (const name of sample.buttons)
          await expect(
            dialog.getByRole('button', { name, exact: true })
          ).toBeEnabled();
        if (sample.story === 'without-way-forward') {
          await expect(
            dialog.getByTestId('permission-denial-action')
          ).toHaveCount(0);
          await expect(
            dialog.getByTestId('permission-denial-dismiss')
          ).toHaveText('OK');
        }
      });
    }
  }
}
