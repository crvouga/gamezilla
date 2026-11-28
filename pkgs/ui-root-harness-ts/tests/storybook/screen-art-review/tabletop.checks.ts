import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';
import { tabletopBoards } from './tabletop-boards';
import { checkChessSeatLayout } from './tabletop-seats';

const screens = [
  'components-illustration--catalog',
  'games-shared-game-tile--motifs',
  'components-inputs-textinput--states',
  'components-inputs-chipgroup--states',
  'components-feedback-spinner--states',
  'components-inputs-button--interactive',
  'components-inputs-button--states',
  'components-data-display-menurow--states',
  'screens-spaces-home--empty',
  'screens-space-home--host-choosing',
  'screens-game-home--with-puzzles-and-settings',
  'screens-matchmaking-searching--searching',
  'screens-game-sessions-stage--against-bot',
  'screens-game-sessions-result--you-win',
  'screens-game-sessions-result--you-placed-second',
  'screens-puzzles-result--solved',
  'screens-puzzles-result--failed',
  'screens-puzzles-stats--populated',
  'screens-matchmaking-ratings--game-rating',
  'screens-profile-tab--ready',
  'screens-friends-list--populated',
  'screens-friends-list--failed-with-cached-friends',
  'screens-account--anonymous',
  'screens-account--signed-in',
  'screens-shell-sso-callback--signing-in',
  'screens-matchmaking-home--guest-allowance-sign-in',
  'screens-settings-index--default',
  'screens-shell-boot-loading--loading',
  'screens-shell-local-database-boot-error--failed',
  'screens-shell-identity-boot--pending',
  'screens-game-sessions-setup--host-ready-to-start',
  'screens-game-sessions-setup--invited-to-play',
  'screens-notifications-inbox--populated',
  'screens-puzzle-packs-stage-progress--completed',
  ...Object.keys(tabletopBoards),
];

async function checkButtonPress(page: Page, info: TestInfo) {
  const button = page.getByRole('button', { name: 'Save' });
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await expect(button).toHaveCSS('background-image', /linear-gradient/);
  // The hosted contexts request reduced motion. A press still changes the
  // edge and keeps the surrounding layout steady.
  await expect(button).toHaveCSS('transition-duration', '0s');
  const restingShadow = await button.evaluate(
    (node) => getComputedStyle(node).boxShadow
  );
  expect(restingShadow).not.toBe('none');
  const bounds = await button.boundingBox();
  await button.hover();
  await page.mouse.down();
  try {
    await expect(button).not.toHaveCSS('box-shadow', restingShadow);
    expect(await button.boundingBox()).toEqual(bounds);
    await page.screenshot({
      path: info.outputPath('primary-button-held.png'),
      animations: 'disabled',
    });
  } finally {
    await page.mouse.up();
  }
}

async function checkWideDrawing(surface: Locator, board: string) {
  if (board !== 'DiscDropBoard' && board !== 'TrailArena') return;
  const rack = board === 'DiscDropBoard';
  const targets = surface.locator(
    rack ? '[data-column] > [data-cell]:last-child' : ':scope > svg'
  );
  await expect(targets).toHaveCount(rack ? 7 : 1);
  for (const target of await targets.all()) {
    await expect(target).toBeInViewport({ ratio: 1 });
  }
}

for (const width of [390, 768, 1280]) {
  const height = width === 390 ? 844 : 800;

  for (const story of screens) {
    // Game boards are exercised at both ends of the responsive range. The shell
    // and control gallery also cover the tablet breakpoint.
    if (width === 768 && tabletopBoards[story]) continue;
    test(`tabletop-review ${story} ${width} dark`, async ({ page }, info) => {
      try {
        await verifyStoryScenario(page, story, {
          width,
          height,
          globals: {},
          suffix: '',
        });
        const canvas = page.locator('#storybook-root');
        const board = tabletopBoards[story];
        if (board) {
          const surface = canvas
            .locator(`[data-component="${board}"]:visible`)
            .first();
          await expect(surface).toBeInViewport();
          if (width === 1280) await checkWideDrawing(surface, board);
          // A precision board pans inside a fixed window. Its drawing may
          // extend off both edges while the player can reach every square.
          const window = canvas.getByRole('region', {
            name: 'Scrollable word board',
          });
          const bounds = await (board === 'WordTileBoard'
            ? window.first()
            : surface
          ).boundingBox();
          if (!bounds) throw new Error(`Missing ${board} in ${story}`);
          expect(bounds.x).toBeGreaterThanOrEqual(-1);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        }
        if (story === 'components-inputs-button--interactive') {
          await checkButtonPress(page, info);
        }
        if (story === 'components-data-display-menurow--states') {
          await expect(canvas.locator('.panel').first()).toHaveCSS(
            'background-image',
            /linear-gradient/
          );
          await expect(
            canvas.locator('[data-component="MenuRow"]').first()
          ).toHaveCSS('background-image', 'none');
        }
        if (story === 'components-feedback-spinner--states') {
          const ring = canvas.locator('[data-component="Spinner"]').first();
          await expect(ring).toHaveClass(/\btext-tint\b/);
          const busy = canvas.locator('button[aria-busy="true"]').first();
          await expect(busy.locator('[data-component="Spinner"]')).toHaveCSS(
            'color',
            await busy.evaluate((el) => getComputedStyle(el).color)
          );
        }
        await canvas.evaluate((root) =>
          Promise.all(
            Array.from(root.querySelectorAll('img'), (image) => image.decode())
          )
        );
        expect(
          await canvas.evaluate((root) => root.scrollWidth)
        ).toBeLessThanOrEqual(width);
      } finally {
        await page.screenshot({
          path: info.outputPath(`${story}--${width}-dark.png`),
          fullPage:
            story === 'components-illustration--catalog' ||
            story === 'games-shared-game-tile--motifs',
          animations: 'disabled',
        });
      }
    });
  }
}

// regression: wide-game-seats-crowd-chessboard
test('tabletop-review two seats leave room for chess at 1280×713 and 390×844', async ({
  page,
}, info) => {
  await checkChessSeatLayout(page, info);
});

// regression: replay-footer-clipped-return
test('tabletop-review all five replay controls fit at 390px and 320px and return to live play', async ({
  page,
}, info) => {
  for (const width of [390, 320]) {
    await verifyStoryScenario(
      page,
      'screens-game-sessions-stage-moves--earlier-move',
      {
        width,
        height: 844,
        globals: {},
        suffix: '',
      }
    );
    const footer = page.locator('[data-game-slot="controls"]');
    const controls = footer.getByRole('button');
    await expect(controls).toHaveCount(5);
    for (const control of await controls.all()) {
      await expect(control).toBeInViewport({ ratio: 1 });
    }
    expect(
      await footer.evaluate((el) => el.scrollWidth - el.clientWidth)
    ).toBeLessThanOrEqual(1);
    const leave = footer.getByRole('button', { name: 'Back to the game' });
    const label = leave.getByText('Back to the game', { exact: true });
    expect(
      await label.evaluate((el) => {
        const text = document.createRange();
        text.selectNodeContents(el);
        const ink = text.getBoundingClientRect();
        for (let clip = el.parentElement; clip; clip = clip.parentElement) {
          const bounds = clip.getBoundingClientRect();
          if (ink.left < bounds.left - 1 || ink.right > bounds.right + 1)
            return false;
          if (clip.tagName === 'BUTTON') break;
        }
        return ink.width > 0;
      })
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`replay-controls-${width}.png`),
    });
    await footer.getByRole('button', { name: 'Next move' }).click();
    await expect(page.getByTestId('game-session-reviewing')).toContainText(
      'Move 4 of 8'
    );
    await leave.click();
    await expect(page.getByTestId('game-session-content')).toHaveAttribute(
      'data-place',
      'stage'
    );
  }
});

// regression: puzzle-stage-status-clips-second-line
test('tabletop-review complete puzzle directions and save feedback fit at 390px and 1280px', async ({
  page,
}) => {
  for (const [story, instruction] of [
    [
      'screens-games-numberlink-puzzle--in-progress',
      'Join each pair of numbers and fill every square.',
    ],
    ['screens-games-sokoban-puzzle--fresh', 'Push each crate onto a goal.'],
  ] as const) {
    await verifyStoryScenario(page, story, {
      width: 390,
      height: 844,
      globals: {},
      suffix: '',
    });
    const status = page.getByRole('region', { name: 'Game status' });
    const rule = status.getByTestId('puzzle-attempt-rule');
    const save = status.getByRole('status');
    await expect(rule).toHaveText(instruction);
    await expect(save).toHaveText('Progress saved on this device.');
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(status).toBeInViewport({ ratio: 1 });
      for (const message of [rule, save]) {
        const visible = await message.evaluate((el) => {
          const clip = el.closest('[role="region"]')?.getBoundingClientRect();
          if (!clip) return false;
          const text = document.createRange();
          text.selectNodeContents(el);
          const lines = Array.from(text.getClientRects());
          return (
            lines.length > 0 &&
            lines.every(
              (line) =>
                line.left >= clip.left - 1 &&
                line.top >= clip.top - 1 &&
                line.right <= clip.right + 1 &&
                line.bottom <= clip.bottom + 1
            )
          );
        });
        expect(visible).toBe(true);
      }
    }
  }
});

// regression: solved-puzzle-coach-clipped
test('tabletop-review the solved puzzle shows a complete line under its trophy at 390px', async ({
  page,
}) => {
  await verifyStoryScenario(page, 'screens-puzzles-result--solved', {
    width: 390,
    height: 844,
    globals: {},
    suffix: '',
  });
  const message = page.locator(
    '[data-component="SpeechBubble"] p[role="status"]'
  );
  await expect(message).toContainText('Checkmate');
  expect(
    await message.evaluate(
      (el) =>
        el.getBoundingClientRect().height >=
        Number.parseFloat(getComputedStyle(el).lineHeight)
    )
  ).toBe(true);
  await expect(page.getByText('3 puzzle streak')).toBeVisible();
});
