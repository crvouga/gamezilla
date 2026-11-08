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
async function reachable(target: Locator, scroll = true): Promise<void> {
  if (scroll) await target.scrollIntoViewIfNeeded();
  const result = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const doc = element.ownerDocument;
    const clear =
      rect.top >= 0 &&
      rect.bottom <= doc.documentElement.clientHeight &&
      rect.left >= 0 &&
      rect.right <= doc.documentElement.clientWidth &&
      [rect.left + 2, rect.right - 2].every((x) =>
        [rect.top + 2, rect.bottom - 2].every((y) => {
          const hit = doc.elementFromPoint(x, y);
          return hit !== null && element.contains(hit);
        })
      );
    // Why it is not clear: its box, each scrolled container and the focus.
    const scrolled = Array.from(doc.querySelectorAll<HTMLElement>('*'))
      .filter((node) => node.scrollTop > 0 || node.scrollLeft > 0)
      .map((node) => ({
        component: node.dataset['component'] ?? node.tagName,
        top: node.scrollTop,
        left: node.scrollLeft,
      }));
    const active = doc.activeElement as HTMLElement | null;
    return {
      clear,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left },
      scrolled,
      focus: active
        ? `${active.tagName} ${active.dataset['testid'] ?? ''} ${active.getAttribute('aria-label') ?? ''}`
        : null,
    };
  });
  if (!result.clear)
    process.stdout.write(`[word-tiles-reachable] ${JSON.stringify(result)}\n`);
  expect(result.clear).toBe(true);
}

export async function narrowWorkspace(
  page: Page,
  info: TestInfo,
  fixture: { players: string; theme: string }
): Promise<void> {
  await openStory(page, `${fixture.players}-player-match`, fixture.theme);
  await reachable(page.getByTestId('custom-game-seat-near'), false);
  await retainEvidence(info, 'local-score-initial.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await reachable(
    page.getByRole('button', { name: 'Find a square', exact: true })
  );
  await reachable(page.getByTestId('custom-game-board-more'));
  await rackTargets(page, info, 'initial', 7);
  await playWord(page, 'touch', () =>
    rackTargets(page, info, 'after-placement', 4)
  );
  await auditAccessibility(page, info);
}

async function rackTargets(
  page: Page,
  info: TestInfo,
  stage: string,
  count: number
): Promise<void> {
  const rack = page.getByTestId('custom-game-board-rack');
  await reachable(rack);
  const tiles = rack.getByRole('button');
  await expect(tiles).toHaveCount(7);
  await expect(rack.locator('button[data-placed="false"]')).toHaveCount(count);
  await expect(rack.locator('button[data-placed="true"]')).toHaveCount(
    7 - count
  );
  await expect(rack.locator('button[aria-disabled="false"]')).toHaveCount(
    count
  );
  await expect(
    rack.locator('button[data-placed="true"][aria-disabled="true"]')
  ).toHaveCount(7 - count);
  const boxes = [];
  for (const tile of await tiles.all()) {
    const box = await tile.boundingBox();
    if (!box) throw new Error('Missing rack target');
    boxes.push(box);
  }
  await retainEvidence(info, `rack-targets-${stage}.json`, {
    body: JSON.stringify(boxes, null, 2),
    contentType: 'application/json',
  });
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const tile of await tiles.all()) await reachable(tile);
  await retainEvidence(info, `rack-targets-${stage}.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

/** The opening phone layout needs no scrolling: one rack row, then the whole board. */
export async function narrowOpeningFits(
  page: Page,
  info: TestInfo,
  fixture: { players: string; theme: string }
): Promise<void> {
  await openStory(page, `${fixture.players}-player-match`, fixture.theme);
  const tops = await page
    .getByTestId('custom-game-board-rack')
    .getByRole('button')
    .evaluateAll((tiles) =>
      tiles.map((tile) => Math.round(tile.getBoundingClientRect().top))
    );
  expect(tops).toHaveLength(7);
  expect(new Set(tops).size).toBe(1);
  await reachable(page.getByTestId('custom-game-seat-near'), false);
  await reachable(page.getByTestId('custom-game-board-submit'), false);
  await reachable(
    page.getByRole('region', { name: 'Scrollable word board' }),
    false
  );
  await retainEvidence(info, 'opening-fits.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}
