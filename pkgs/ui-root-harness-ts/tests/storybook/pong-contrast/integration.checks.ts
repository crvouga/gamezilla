import { contrastRatio, parseColor } from '@pkgs/ui-root-shared-ts/contrast';
import { expect, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';
import { logVideo } from '../pong-overhaul/log-evidence';

test.use({ video: 'on', trace: 'on' });

// regression: pong-uncontrolled-paddle-contrast
test('storybook integration: pong-overhaul spectator paddle boundaries remain visible', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPong(page, 'watching', theme);
    const colors = await page.getByRole('application').evaluate((court) => ({
      background: getComputedStyle(court).backgroundColor,
      paddles: [
        ...court.querySelectorAll('rect[data-side][data-controlled]'),
      ].map((paddle) => {
        const style = getComputedStyle(paddle);
        return {
          fill: style.fill,
          stroke: style.stroke,
          width: Number.parseFloat(style.strokeWidth),
        };
      }),
    }));
    const background = parseColor(colors.background);
    if (!background)
      throw new Error(`Invalid court color: ${colors.background}`);
    await info.attach(`paddle-colors-${theme}`, {
      body: JSON.stringify(colors),
      contentType: 'application/json',
    });
    await recordPong(page, info, `spectator-contrast-${theme}`);
    expect(colors.paddles).toHaveLength(2);
    for (const paddle of colors.paddles) {
      const fill = parseColor(paddle.fill);
      const stroke = parseColor(paddle.stroke);
      const fillContrast = fill ? contrastRatio(fill, background) : 0;
      const edgeContrast =
        stroke && paddle.width >= 2 ? contrastRatio(stroke, background) : 0;
      expect(Math.max(fillContrast, edgeContrast)).toBeGreaterThanOrEqual(3);
    }
  }
  await logVideo(page, 'spectator-contrast');
});

// axe leaves Pong's court text "incomplete" (bgOverlap): the drag hint ignores
// pointers, so hit testing reaches the lane drawn beneath it. Check that text
// against its real backgrounds instead, the lane taken fully opaque.
test('storybook integration: pong-overhaul court and scoreboard text meet 4.5:1 on their backgrounds', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPong(page, 'paddle-movement', theme);
    const pairs = await page.evaluate(() => {
      const opaque = (element: Element | null): string => {
        for (let at = element; at; at = at.parentElement) {
          const color = getComputedStyle(at).backgroundColor;
          if (!/rgba\(.*,\s*0\)$|transparent/.test(color)) return color;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const court = document.querySelector('[data-component="PaddleCourt"]');
      if (!court) throw new Error('Missing Pong court');
      const lane = court.querySelector('rect:not([data-side])');
      const canvas = getComputedStyle(court).backgroundColor;
      const result: { text: string; fg: string; bg: string }[] = [];
      for (const hint of court.querySelectorAll('[data-testid$="-gesture"]')) {
        const fg = getComputedStyle(hint).color;
        result.push({ text: hint.textContent, fg, bg: canvas });
        if (lane)
          result.push({
            text: `${hint.textContent} over lane`,
            fg,
            bg: getComputedStyle(lane).fill,
          });
      }
      const status = court.querySelector('[role="status"], [aria-live]');
      if (status?.textContent)
        result.push({
          text: status.textContent,
          fg: getComputedStyle(status).color,
          bg: opaque(status),
        });
      for (const label of document.querySelectorAll(
        '[data-testid$="-scoreboard"] span span'
      ))
        result.push({
          text: label.textContent,
          fg: getComputedStyle(label).color,
          bg: opaque(label),
        });
      return result;
    });
    await info.attach(`court-text-contrast-${theme}`, {
      body: JSON.stringify(pairs, null, 2),
      contentType: 'application/json',
    });
    expect(pairs.length).toBeGreaterThanOrEqual(5);
    for (const pair of pairs) {
      const fg = parseColor(pair.fg);
      const bg = parseColor(pair.bg);
      if (!fg || !bg)
        throw new Error(
          `Unreadable colors for ${pair.text}: ${pair.fg} on ${pair.bg}`
        );
      expect({ text: pair.text, ratio: contrastRatio(fg, bg) >= 4.5 }).toEqual({
        text: pair.text,
        ratio: true,
      });
    }
  }
});

// The court's focus ring was 1.55:1 against the light page and its sides
// were clipped by the board.
// regression: pong-court-focus-ring-faint-and-clipped
test('storybook integration: pong-overhaul court focus ring is visible and whole', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark'])
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 844, height: 390 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await openPong(page, 'paddle-movement', theme);
      const court = page.getByRole('application', { name: 'Pong court' });
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Tab');
        if (
          await court.evaluate((element) => element === document.activeElement)
        )
          break;
      }
      await expect(court).toBeFocused();
      const ring = await court.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.outlineColor,
          width: Number.parseFloat(style.outlineWidth),
          offset: Number.parseFloat(style.outlineOffset),
          canvas: style.backgroundColor,
        };
      });
      await info.attach(`focus-ring-${theme}-${viewport.width}`, {
        body: JSON.stringify(ring),
        contentType: 'application/json',
      });
      const color = parseColor(ring.color);
      const canvas = parseColor(ring.canvas);
      if (!color || !canvas)
        throw new Error(`Unreadable ring ${JSON.stringify(ring)}`);
      // Drawn inside the court's edge, on its own canvas, so nothing clips it.
      expect(ring.width).toBeGreaterThanOrEqual(2);
      expect(ring.offset).toBeLessThanOrEqual(-ring.width);
      expect(contrastRatio(color, canvas)).toBeGreaterThanOrEqual(3);
      if (viewport.width === 390)
        await recordPong(page, info, `court-focus-${theme}-${viewport.width}`);
    }
});
