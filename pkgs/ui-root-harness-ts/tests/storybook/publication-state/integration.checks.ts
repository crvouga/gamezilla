import { expect, test } from '@playwright/test';

const samples = [
  {
    story: 'publish-pending',
    status: 'Awaiting confirmation',
    action: 'Send again',
  },
  {
    story: 'publish-pending-offline',
    status: 'Waiting for connection',
    action: 'Send again',
  },
  { story: 'published', status: 'Published', action: 'Send again' },
];

for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const sample of samples) {
      // regression: publication-current-copy-status-ambiguous
      test(`storybook integration: ${sample.story} has truthful publication status at ${width}/${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          `/iframe.html?id=screens-puzzles-content-author-publish--${sample.story}&viewMode=story&globals=theme:${theme}`
        );
        await expect(page.locator('#storybook-root')).toHaveAttribute(
          'data-story-ready',
          'true'
        );
        await expect(
          page.getByTestId('content-publication-status')
        ).toHaveCount(1);
        await expect(page.getByTestId('content-publication-status')).toHaveText(
          sample.status
        );
        await expect(
          page.getByText(sample.status, { exact: true })
        ).toHaveCount(1);
        const repeat = page.getByTestId('content-publish');
        await expect(repeat).toHaveCount(1);
        await expect(repeat).toHaveAccessibleName(sample.action);
        await expect(repeat).toBeEnabled();
        await expect(
          page.getByText(
            'Ready: publish to share it with everyone who plays.',
            { exact: true }
          )
        ).toHaveCount(0);
        if (sample.story === 'published') {
          await expect(
            page.getByTestId('content-view-publication')
          ).toHaveCount(1);
          await expect(
            page.getByTestId('content-view-publication')
          ).toHaveAccessibleName('View published edition');
        }
      });
    }
  }
}
