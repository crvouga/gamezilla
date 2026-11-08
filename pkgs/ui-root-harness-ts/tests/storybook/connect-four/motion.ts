// @io-wall-ok — browser animation observations recorded by the automated harness.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureBoard, openBoard } from './capture';

/**
 * Sample the destination disc every frame for a fixed window after the
 * drop, independent of animation names or event delivery: position plus
 * the animations actually running on it.
 */
async function observeDrop(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    const samples: {
      time: number;
      top: number;
      animations: string[];
    }[] = [];
    let start: number | undefined;
    const frame = (time: number) => {
      const disc = root.querySelector('[data-cell="1"] > span');
      if (disc?.closest('[data-disc="1"]')) {
        start ??= time;
        samples.push({
          time,
          top: disc.getBoundingClientRect().top,
          animations: disc
            .getAnimations()
            .map((animation) =>
              animation instanceof CSSAnimation
                ? animation.animationName
                : animation.constructor.name
            ),
        });
      }
      if (start === undefined || time - start < 600)
        requestAnimationFrame(frame);
      else root.setAttribute('data-drop-motion', JSON.stringify(samples));
    };
    requestAnimationFrame(frame);
  });
}

export async function captureMotion(
  page: Page,
  info: TestInfo,
  theme: string,
  reduced: boolean
) {
  await page.emulateMedia({
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await openBoard(page, 'drop-a-disc', theme);
  // The canonical Storybook preview injects reduced motion for stable
  // screenshots, and a global rule then stops every animation. Remove that
  // injected preference so the emulated media query alone decides, as on
  // a device; otherwise both branches below would pass or fail vacuously.
  const injected = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll('[data-reduced-motion]')];
    for (const host of hosts) host.removeAttribute('data-reduced-motion');
    return hosts.length;
  });
  await info.attach('injected-reduced-motion-removed', {
    body: JSON.stringify({ hosts: injected }),
    contentType: 'application/json',
  });
  await expect(page.locator('[data-reduced-motion]')).toHaveCount(0);
  await observeDrop(page);
  await page.getByTestId('custom-game-board-column-2').click();
  const disc = page.getByTestId('custom-game-board-cell-1').locator('span');
  await expect(page.getByTestId('custom-game-board-cell-1')).toHaveAttribute(
    'data-disc',
    '1'
  );
  if (reduced) {
    await expect(disc).toHaveCSS('animation-name', 'none');
    expect(await disc.evaluate((node) => node.getAnimations().length)).toBe(0);
  } else {
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-drop-motion',
      /.+/
    );
    const samples = JSON.parse(
      (await page
        .locator('#storybook-root')
        .getAttribute('data-drop-motion')) ?? '[]'
    ) as { time: number; top: number; animations: string[] }[];
    // Attach before asserting, so a failure still shows what ran.
    await info.attach('normal-motion-frames', {
      body: JSON.stringify(samples),
      contentType: 'application/json',
    });
    expect(samples.some((sample) => sample.animations.length > 0)).toBe(true);
    expect(samples.at(-1)?.top).toBeGreaterThan(samples[0]?.top ?? 0);
  }
  await captureBoard(
    page,
    info,
    reduced ? 'reduced-motion-drop' : 'normal-motion-drop'
  );
}
