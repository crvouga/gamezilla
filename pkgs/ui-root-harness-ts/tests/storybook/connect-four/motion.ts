// @io-wall-ok — browser animation observations recorded by the automated harness.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureBoard, openBoard } from './capture';

async function observeDrop(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing canvas');
    const samples: { time: number; top: number }[] = [];
    let running = false;
    const cell = root.querySelector('[data-cell="1"] > span');
    if (!cell) throw new Error('Missing destination');
    const frame = () => {
      samples.push({
        time: performance.now(),
        top: cell.getBoundingClientRect().top,
      });
      if (running) requestAnimationFrame(frame);
      else root.setAttribute('data-drop-motion', JSON.stringify(samples));
    };
    cell.addEventListener('animationstart', (event) => {
      if (
        !(event instanceof AnimationEvent) ||
        !event.animationName.includes('disc-drop')
      )
        return;
      running = true;
      requestAnimationFrame(frame);
    });
    cell.addEventListener('animationend', (event) => {
      if (
        event instanceof AnimationEvent &&
        event.animationName.includes('disc-drop')
      )
        running = false;
    });
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
    ) as { time: number; top: number }[];
    expect(samples.length).toBeGreaterThan(1);
    expect(samples.at(-1)?.top).toBeGreaterThan(samples[0]?.top ?? 0);
    await info.attach('normal-motion-frames', {
      body: JSON.stringify(samples),
      contentType: 'application/json',
    });
  }
  await captureBoard(
    page,
    info,
    reduced ? 'reduced-motion-drop' : 'normal-motion-drop'
  );
}
