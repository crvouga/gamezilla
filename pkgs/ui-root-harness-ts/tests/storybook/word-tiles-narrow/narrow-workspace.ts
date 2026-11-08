import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { auditAccessibility, openStory } from '../word-tiles/evidence';
import { playWord } from '../word-tiles/native-input';
import { retainEvidence } from '../word-tiles/retained-evidence';

/** Scrollable flow is valid only when the complete target can be brought clear. */
async function reachable(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  expect(
    await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const doc = element.ownerDocument;
      return (
        rect.top >= 0 &&
        rect.bottom <= doc.documentElement.clientHeight &&
        rect.left >= 0 &&
        rect.right <= doc.documentElement.clientWidth &&
        [rect.left + 2, rect.right - 2].every((x) =>
          [rect.top + 2, rect.bottom - 2].every((y) => {
            const hit = doc.elementFromPoint(x, y);
            return hit !== null && element.contains(hit);
          })
        )
      );
    })
  ).toBe(true);
}

export async function narrowWorkspace(
  page: Page,
  info: TestInfo,
  fixture: { players: string; theme: string }
): Promise<void> {
  await openStory(page, `${fixture.players}-player-match`, fixture.theme);
  await reachable(page.getByTestId('custom-game-seat-near'));
  await retainEvidence(info, 'local-score-after-scroll.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await reachable(
    page.getByRole('button', { name: 'Board map: locate a square' })
  );
  await reachable(page.getByTestId('custom-game-board-more'));
  const rack = page.getByTestId('custom-game-board-rack');
  await reachable(rack);
  const tiles = rack.getByRole('button');
  await expect(tiles).toHaveCount(7);
  const boxes = [];
  for (const tile of await tiles.all()) {
    const box = await tile.boundingBox();
    if (!box) throw new Error('Missing rack target');
    boxes.push(box);
  }
  await retainEvidence(info, 'rack-targets.json', {
    body: JSON.stringify(boxes, null, 2),
    contentType: 'application/json',
  });
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const tile of await tiles.all()) await reachable(tile);
  await playWord(page, 'touch');
  await auditAccessibility(page, info);
}
