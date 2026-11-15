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
      const [marker, body] = [...item.children];
      const [label, state] = [...(body?.children ?? [])];
      if (!marker || !body || !label || !state) return [];
      return [
        {
          labelTop: label.getBoundingClientRect().top,
          stateTop: state.getBoundingClientRect().top,
          bodyLeft: body.getBoundingClientRect().left,
          markerRight: marker.getBoundingClientRect().right,
          stateRight: state.getBoundingClientRect().right,
          rowRight: item.getBoundingClientRect().right,
        },
      ];
    })
  );
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    // The state follows its name vertically, with the body beside its marker.
    expect(row.stateTop).toBeGreaterThan(row.labelTop);
    expect(row.bodyLeft - row.markerRight).toBeGreaterThanOrEqual(0);
    expect(row.bodyLeft - row.markerRight).toBeLessThan(16);
    expect(row.stateRight).toBeLessThanOrEqual(row.rowRight);
  }
});
