import { expect, type Page, test } from '@playwright/test';

async function open(
  page: Page,
  story: string,
  viewport: { width: number; height: number },
  theme: string
) {
  await page.setViewportSize(viewport);
  await page.goto(
    `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

// regression: numberlink-endpoint-controls-clipped
for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  for (const theme of ['light', 'dark'])
    for (const state of ['new-drawing', 'five-by-five'])
      test(`storybook integration: Numberlink ${state} placement choices fit beside their canvas at ${viewport.width}/${theme}`, async ({
        page,
      }) => {
        await open(
          page,
          `screens-games-numberlink-editor--${state}`,
          viewport,
          theme
        );
        const choices = page.getByTestId('numberlink-move-first').locator('..');
        const geometry = await choices.evaluate((group) => {
          const rect = group.getBoundingClientRect();
          const clipped = Array.from(
            group.querySelectorAll('[data-testid^="numberlink-move-"]')
          ).flatMap((radio) => {
            const label = radio.querySelector('span');
            if (label === null) return ['Missing endpoint label'];
            const range = document.createRange();
            range.selectNodeContents(label);
            const text = range.getBoundingClientRect();
            const target = radio.getBoundingClientRect();
            return text.left >= target.left &&
              text.right <= target.right &&
              target.left >= rect.left &&
              target.right <= rect.right
              ? []
              : [label.textContent];
          });
          return {
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            clipped,
          };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(viewport.width);
        expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
        expect(geometry.clipped).toEqual([]);
        const board = await page.getByTestId('numberlink-board').boundingBox();
        if (board === null) throw new Error('Numberlink board is missing');
        expect(geometry.bottom).toBeLessThanOrEqual(board.y);
        await expect(
          page.getByTestId('numberlink-move-first')
        ).toHaveAccessibleName('First endpoint');
        await expect(
          page.getByTestId('numberlink-move-second')
        ).toHaveAccessibleName('Second endpoint');
      });
}

// regression: numberlink-endpoint-controls-clipped
test('storybook integration: the relocated pair and endpoint pickers retain their wiring and keyboard selection', async ({
  page,
}) => {
  await open(
    page,
    'screens-games-numberlink-editor--new-drawing',
    { width: 390, height: 844 },
    'light'
  );
  await page
    .getByTestId('numberlink-placement')
    .getByRole('button', { name: 'Pair', exact: true })
    .click();
  await page.getByRole('option', { name: '2', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Pair label' })).toHaveValue(
    '2'
  );
  const first = page.getByTestId('numberlink-move-first');
  const second = page.getByTestId('numberlink-move-second');
  await first.focus();
  await first.press('ArrowRight');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-checked', 'true');
  await expect(first).toHaveAttribute('aria-checked', 'false');
});

test('storybook integration: disabled and empty Numberlink placement states stay honest', async ({
  page,
}) => {
  await open(
    page,
    'screens-games-numberlink-editor--disabled',
    { width: 390, height: 844 },
    'light'
  );
  await expect(page.getByTestId('numberlink-move-first')).toBeDisabled();
  await expect(page.getByTestId('numberlink-move-second')).toBeDisabled();
  await expect(
    page
      .getByTestId('numberlink-placement')
      .getByRole('button', { name: 'Pair', exact: true })
  ).toBeDisabled();
  await open(
    page,
    'screens-games-numberlink-editor--no-pairs',
    { width: 390, height: 844 },
    'light'
  );
  await expect(page.getByTestId('numberlink-move')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add pair', exact: true })
  ).toBeEnabled();
});

// regression: sokoban-palette-lift-crate-truncated
for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
])
  for (const theme of ['light', 'dark'])
    test(`storybook integration: Sokoban full tool names fit equal-height tiles at ${viewport.width}/${theme}`, async ({
      page,
    }) => {
      await open(
        page,
        'screens-games-sokoban-editor--new-board',
        viewport,
        theme
      );
      const tools = page.getByTestId('sokoban-tools').getByRole('radio');
      await expect(
        page.getByRole('radio', { name: 'Lift crate', exact: true })
      ).toBeVisible();
      const measurements = await tools.evaluateAll((radios) =>
        radios.map((radio) => {
          const target = radio.getBoundingClientRect();
          const label = radio.lastElementChild;
          if (label === null) throw new Error('A tool has no visible name');
          const range = document.createRange();
          range.selectNodeContents(label);
          const lines = Array.from(range.getClientRects());
          return {
            label: label.textContent,
            height: target.height,
            top: target.top,
            firstLineTop: lines[0]?.top ?? null,
            visible:
              lines.length > 0 &&
              lines.every(
                (line) =>
                  line.left >= target.left &&
                  line.right <= target.right &&
                  line.top >= target.top &&
                  line.bottom <= target.bottom
              ),
            fits:
              label.scrollWidth <= label.clientWidth + 1 &&
              label.scrollHeight <= label.clientHeight + 1,
          };
        })
      );
      expect(
        measurements.filter((item) => !item.visible || !item.fits)
      ).toEqual([]);
      expect(
        measurements.find((item) => item.label === 'Lift crate')
      ).toBeDefined();
      for (const item of measurements) {
        const row = measurements.filter(
          (other) => Math.abs(other.top - item.top) <= 1
        );
        const tops = row.map((other) => other.firstLineTop ?? Number.NaN);
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
      }
      expect(
        Math.max(...measurements.map((item) => item.height)) -
          Math.min(...measurements.map((item) => item.height))
      ).toBeLessThanOrEqual(1);
    });
