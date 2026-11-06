import { expect, within } from 'storybook/test';

/** Check discoverability before an interaction can scroll a hidden action into view. */
export async function expectHillPassVisible(canvasElement: HTMLElement) {
  const pass = await within(canvasElement).findByTestId(
    'custom-game-board-action-pass'
  );
  const window = pass.ownerDocument.defaultView;
  if (window === null) throw new Error('Hill story has no browser window');
  await expect(pass).toBeVisible();
  await expect(pass).toBeEnabled();
  const bounds = pass.getBoundingClientRect();
  await expect(bounds.width).toBeGreaterThan(0);
  await expect(bounds.height).toBeGreaterThan(0);
  await expect(bounds.left).toBeGreaterThanOrEqual(0);
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  for (let parent = pass.parentElement; parent; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    const clip = parent.getBoundingClientRect();
    if (style.overflowX !== 'visible') {
      await expect(bounds.left).toBeGreaterThanOrEqual(clip.left);
      await expect(bounds.right).toBeLessThanOrEqual(clip.right);
    }
    if (style.overflowY !== 'visible') {
      await expect(bounds.top).toBeGreaterThanOrEqual(clip.top);
      await expect(bounds.bottom).toBeLessThanOrEqual(clip.bottom);
    }
  }
  return pass;
}
