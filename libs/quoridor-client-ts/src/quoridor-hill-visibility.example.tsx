import { expect, within } from 'storybook/test';

/** Check discoverability before an interaction can scroll a hidden action into view. */
export async function expectHillPassVisible(canvasElement: HTMLElement) {
  // regression: quoridor-hill-forced-pass-clipped
  const canvas = within(canvasElement);
  const guidance = await canvas.findByTestId('custom-game-board-wall-status');
  await expect(guidance).toHaveTextContent(/pass/i);
  await expect(guidance).not.toHaveTextContent(
    /choose a marked square|tap a square/i
  );
  for (const mode of ['move', 'h', 'v']) {
    await expect(
      canvas.queryByTestId(`custom-game-board-mode-${mode}`)
    ).not.toBeInTheDocument();
  }
  const pass = await canvas.findByTestId('custom-game-board-action-pass');
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
