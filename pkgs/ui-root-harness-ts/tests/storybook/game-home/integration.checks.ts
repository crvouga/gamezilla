// @io-wall-ok — compare the mode artwork displayed by the browser with the registered Fluent assets.
import { readFileSync } from 'node:fs';
import { expect, type Locator, test } from '@playwright/test';
import { verifyStoryScenario } from '../verify-story-scenario';

async function expectArtwork(row: Locator, name: string) {
  const image = row.locator('img');
  const expected = readFileSync(
    new URL(
      `../../../../ui-root-client-ts/assets/fluent-emoji/${name}.webp`,
      import.meta.url
    )
  );
  const actual = await image.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    const body = await (await fetch(el.currentSrc)).arrayBuffer();
    return { width: el.naturalWidth, bytes: Array.from(new Uint8Array(body)) };
  });
  expect(actual.width).toBe(96);
  expect(Buffer.from(actual.bytes).equals(expected)).toBe(true);
}

for (const width of [390, 1280]) {
  test(`storybook integration: direct Connect Four menu at ${width}px`, async ({
    page,
  }, info) => {
    await verifyStoryScenario(page, 'screens-game-home--shared-choices', {
      width,
      height: width === 390 ? 844 : 800,
      suffix: '',
      globals: { spaceRole: 'host' },
    });
    const menu = page.getByTestId('game-choices');
    const list = menu.getByRole('list');
    await expect(list.getByRole('button')).toHaveText([
      'Matchmaking',
      'Play a Friend',
      'Play Bots',
      'History and stats',
      'How to play',
    ]);
    await expect(
      menu.getByRole('button', { name: 'More', exact: true })
    ).toHaveCount(0);
    const board = await menu.locator('[data-motif="discs"]').boundingBox();
    const title = await menu
      .getByRole('heading', { name: 'Connect Four', exact: true })
      .boundingBox();
    const rows = await list.boundingBox();
    if (!board || !title || !rows)
      throw new Error('Missing game identity or action list');
    expect(board.y + board.height).toBeLessThanOrEqual(title.y);
    expect(title.y + title.height).toBeLessThanOrEqual(rows.y);
    const center = rows.x + rows.width / 2;
    for (const box of [board, title]) {
      expect(Math.abs(box.x + box.width / 2 - center)).toBeLessThanOrEqual(1);
    }
    await expectArtwork(
      list.getByRole('button', { name: 'Play a Friend' }),
      'handshake'
    );
    await expectArtwork(
      list.getByRole('button', { name: 'Play Bots' }),
      'robot'
    );
    await page.screenshot({
      path: info.outputPath(`connect-four-menu-${width}.png`),
      animations: 'disabled',
    });
  });
}
