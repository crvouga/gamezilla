import { expect, type Page, test } from '@playwright/test';

async function panelTop(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=screens-puzzles-content-attempt-progress--${story}&viewMode=story`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const panel = await page.getByTestId('puzzle-attempt-panel').boundingBox();
  if (!panel) throw new Error('The pack card is missing');
  return Math.round(panel.y);
}

/** Where the board's own commands sit on the attempt's board. */
async function commandsTop(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=screens-puzzles-content-attempt--${story}&viewMode=story`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const commands = await page
    .getByTestId('content-open-progress')
    .boundingBox();
  if (!commands) throw new Error('The board has no commands');
  return Math.round(commands.y);
}

// regression: puzzle-solved-way-on-moves-pack-card
// The pack card is on the attempt's progress screen; the next puzzle joins
// the solved headline with the commands (above them in a phone's bar,
// under them in the rail beside a wide board), so neither the card nor the
// board's commands move when the puzzle is solved.
test('storybook integration: solving a pack puzzle leaves its pack card and commands in place', async ({
  page,
}) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await panelTop(page, 'pack-in-progress');
    const after = await panelTop(page, 'pack-completed');
    expect(after, `pack card at ${width}px`).toBe(before);
    const resting = await commandsTop(page, 'pack-in-progress');
    const solved = await commandsTop(page, 'pack-completed');
    expect(solved, `board commands at ${width}px`).toBe(resting);
    await expect(page.getByTestId('content-next-puzzle')).toBeInViewport({
      ratio: 1,
    });
  }
});
