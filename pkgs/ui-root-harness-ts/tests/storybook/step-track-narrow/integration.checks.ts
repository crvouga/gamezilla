import { expect, test } from '@playwright/test';

const viewport = { width: 390, height: 844 };
test.use({ viewport });

// regression: step-track-stacked-actions-centre-their-names
test('storybook integration: stacked step actions keep their names at the start', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=components-inputs-steptrack--states&viewMode=story'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  const rows = await page.locator('ol > li').evaluateAll((items) =>
    items.flatMap((item) => {
      const [marker, label, state] = [...item.children];
      const acts =
        label?.matches('button') === true ||
        label?.querySelector('button') !== null;
      if (!marker || !label || !state || !acts) return [];
      return [
        {
          labelLeft: label.getBoundingClientRect().left,
          labelRight: label.getBoundingClientRect().right,
          stateLeft: state.getBoundingClientRect().left,
          markerRight: marker.getBoundingClientRect().right,
        },
      ];
    })
  );
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    // Not stretched across to the state word, and starting beside the marker.
    expect(row.stateLeft - row.labelRight).toBeGreaterThan(16);
    expect(row.labelLeft - row.markerRight).toBeLessThan(16);
  }
});
