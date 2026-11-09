import { expect, type Page, type TestInfo } from '@playwright/test';

/** Native pointer and keyboard proposal editing supplements synthetic story play. */
export async function exerciseQuoridorNativeInput(page: Page, info: TestInfo) {
  const activate = async (id: string) => {
    const target = page.getByTestId(`custom-game-board-${id}`);
    if (page.viewportSize()?.width === 390) await target.tap();
    else await target.click();
  };
  const capture = async (name: string) =>
    info.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  await activate('mode-h');
  await activate('action-d4h');
  const anchor = page.getByTestId('custom-game-board-action-d4h');
  await expect(anchor).toHaveAttribute('data-preview-edge-top', 'true');
  await expect(anchor).toHaveAttribute('data-edge-top', 'false');
  await expect(page.getByTestId('custom-game-board-wall-commit')).toBeEnabled();
  await capture('native-horizontal-preview');
  await activate('mode-v');
  await expect(
    page.getByTestId('custom-game-board-action-d4v')
  ).toHaveAttribute('data-preview-edge-right', 'true');
  await capture('native-vertical-preview');
  await activate('wall-cancel');
  await expect(page.getByTestId('custom-game-board-wall-commit')).toHaveCount(
    0
  );
  const keyboardAnchor = page.getByTestId('custom-game-board-action-d4v');
  await keyboardAnchor.focus();
  await keyboardAnchor.press('ArrowRight');
  const next = page.getByTestId('custom-game-board-action-e4v');
  await expect(next).toBeFocused();
  await next.press('Enter');
  await expect(next).toHaveAttribute('data-preview-edge-right', 'true');
  await capture('native-keyboard-preview');
  const cancel = page.getByTestId('custom-game-board-wall-cancel');
  await cancel.focus();
  await cancel.press('Enter');
  await expect(page.getByTestId('custom-game-board-wall-commit')).toHaveCount(
    0
  );
  await expect(next).toHaveAttribute('data-edge-right', 'false');
  // Cancel unmounts itself; focus returns to the active wall tool.
  await expect(page.getByTestId('custom-game-board-mode-v')).toBeFocused();
  await capture('native-cancelled');
  // Trusted Escape on the board cancels a proposal and keeps the anchor focused.
  await next.focus();
  await next.press('Enter');
  await expect(page.getByTestId('custom-game-board-wall-commit')).toBeEnabled();
  await next.press('Escape');
  await expect(page.getByTestId('custom-game-board-wall-commit')).toHaveCount(
    0
  );
  await expect(next).toHaveAttribute('data-preview-edge-right', 'false');
  await expect(next).toBeFocused();
  await info.attach('native-input-metrics', {
    body: JSON.stringify(
      await page.evaluate(
        () =>
          (window as unknown as { quoridorMetrics: unknown }).quoridorMetrics
      )
    ),
    contentType: 'application/json',
  });
}
