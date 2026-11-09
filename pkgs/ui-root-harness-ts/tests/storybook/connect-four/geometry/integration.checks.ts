import { expect, test } from '@playwright/test';
import { captureBoard } from '../capture';
import { boardContext } from '../matrix';
import { captureTouchEdges } from '../touch';

test.use(boardContext(320));

// regression: connect-four-320-column-targets-narrow
test('storybook integration: connect-four 320px has seven 44px native column targets', async ({
  page,
}, info) => {
  await captureTouchEdges(page, info, 'light');
  const targets = await page.locator('[data-column]').evaluateAll((columns) =>
    columns.map((column) => {
      const rect = column.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      return {
        column: column.getAttribute('data-column'),
        width: rect.width,
        left: rect.left,
        right: rect.right,
        leftHit: document
          .elementFromPoint(rect.left + 2, y)
          ?.closest('[data-column]')
          ?.getAttribute('data-column'),
        rightHit: document
          .elementFromPoint(rect.right - 2, y)
          ?.closest('[data-column]')
          ?.getAttribute('data-column'),
      };
    })
  );
  await info.attach('native-320-targets', {
    body: JSON.stringify(targets, null, 2),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'native-320-targets');
  expect(targets).toHaveLength(7);
  for (const [index, target] of targets.entries()) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.left).toBeGreaterThanOrEqual(0);
    expect(target.right).toBeLessThanOrEqual(320);
    expect(target.leftHit).toBe(target.column);
    expect(target.rightHit).toBe(target.column);
    if (index > 0)
      expect(target.left).toBeGreaterThanOrEqual(
        targets[index - 1]?.right ?? 0
      );
  }
});
