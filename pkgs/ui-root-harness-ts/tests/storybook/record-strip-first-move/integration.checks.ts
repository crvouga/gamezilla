import { expect, type Page, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on' });

/** Where the board starts, and the heights of the card's two rows. */
async function stripGeometry(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=screens-games-battleship-board--${story}&viewMode=story&globals=theme:light`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.getByTestId('custom-game-record-caption')).toBeVisible();
  return page.evaluate(() => {
    const box = (id: string) =>
      document
        .querySelector(`[data-testid="${id}"]`)
        ?.getBoundingClientRect() ?? null;
    const board = box('custom-game-board');
    const caption = box('custom-game-record-caption');
    const head = box('custom-game-move-strip-head');
    return {
      boardTop: (board?.top ?? Number.NaN) + window.scrollY,
      captionHeight: caption?.height ?? Number.NaN,
      headHeight: head?.height ?? Number.NaN,
      captionAboveHead:
        caption !== null && head !== null && caption.bottom <= head.top,
    };
  });
}

// regression: phone-strip-first-move-reflow
test('storybook integration: the phone record card keeps one arrangement from no moves to the first moves', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Opening has no moves ("No moves yet."); Your turn has recorded volleys.
  const empty = await stripGeometry(page, 'opening');
  await expect(page.getByTestId('custom-game-move-strip')).toHaveText(
    'No moves yet.'
  );
  const played = await stripGeometry(page, 'your-turn');
  await expect(page.getByTestId('custom-game-move-strip')).not.toHaveText(
    'No moves yet.'
  );
  // The game's line sits above the strip in both states...
  expect([empty.captionAboveHead, played.captionAboveHead]).toEqual([
    true,
    true,
  ]);
  // ...so the board moves only by what the line and the moves themselves
  // add, never by the card rearranging. A game whose line and turn keep
  // their height (Word Tiles) therefore keeps its board still.
  const shift = played.boardTop - empty.boardTop;
  const content =
    played.captionHeight -
    empty.captionHeight +
    (played.headHeight - empty.headHeight);
  expect(Math.abs(shift - content)).toBeLessThanOrEqual(1);
});
