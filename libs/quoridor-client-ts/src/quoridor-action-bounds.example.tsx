import { expect, within } from 'storybook/test';

// regression: quoridor-intrinsic-action-clipping
export async function expectQuoridorActionsFit(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  for (const id of ['mode-move', 'mode-h', 'mode-v']) {
    const action = await canvas.findByTestId(`custom-game-board-${id}`);
    const view = action.ownerDocument.defaultView;
    if (!view) throw new Error('The story requires a browser window');
    const rect = action.getBoundingClientRect();
    await expect(rect.width).toBeGreaterThan(0);
    await expect(rect.left).toBeGreaterThanOrEqual(0);
    await expect(rect.right).toBeLessThanOrEqual(view.innerWidth);
    await expect(rect.bottom).toBeLessThanOrEqual(view.innerHeight);
    for (
      let parent = action.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const bounds = parent.getBoundingClientRect();
      if (view.getComputedStyle(parent).overflowX !== 'visible') {
        await expect(rect.right).toBeLessThanOrEqual(bounds.right);
        await expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
      }
    }
  }
}
