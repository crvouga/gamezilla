// @io-wall-ok — trusted browser input; the canonical runner owns cleanup.
import { expect, type Locator, type Page } from '@playwright/test';

/** Refused cards remain pressable to explain the rule. Playwright's locator
 * actions wait for aria-disabled to clear, so use the physical input port
 * after checking visibility and the actual hit target at the card's centre. */
export async function pressRefusedCard(
  page: Page,
  card: Locator,
  touch: boolean
) {
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-disabled', 'true');
  await card.scrollIntoViewIfNeeded();
  const point = await card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = element.ownerDocument.elementFromPoint(x, y);
    if (hit === null || !element.contains(hit))
      throw new Error('The refused card is not the pointer hit target');
    return { x, y };
  });
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
