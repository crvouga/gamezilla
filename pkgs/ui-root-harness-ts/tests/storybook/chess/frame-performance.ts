// @io-wall-ok — automated browser evidence observes browser timing and writes test artifacts.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { openChessStory, squareCenter } from './evidence';

type Recorder = {
  frames: number[];
  longTasks: number[];
  recording: boolean;
};

/** The page's recorder slot, read only inside `page.evaluate`. */
type RecorderHost = { __chessRecorder?: Recorder };

/** Frame timestamps and long tasks, recorded until `stopRecording`. */
async function startRecording(page: Page) {
  await page.evaluate(() => {
    const recorder: Recorder = { frames: [], longTasks: [], recording: true };
    (window as unknown as RecorderHost).__chessRecorder = recorder;
    const tick = (time: number) => {
      if (!recorder.recording) return;
      recorder.frames.push(time);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((list) => {
      if (recorder.recording)
        recorder.longTasks.push(
          ...list.getEntries().map((entry) => entry.duration)
        );
    }).observe({ type: 'longtask', buffered: false });
  });
}

async function stopRecording(page: Page) {
  return page.evaluate(() => {
    const recorder = (window as unknown as RecorderHost).__chessRecorder;
    if (!recorder) throw new Error('Missing recorder');
    recorder.recording = false;
    const gaps = recorder.frames
      .slice(1)
      .map((time, index) => time - (recorder.frames[index] ?? time));
    const sorted = [...gaps].sort((a, b) => a - b);
    return {
      frames: recorder.frames.length,
      medianFrameMs: sorted[Math.floor(sorted.length / 2)] ?? null,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? null,
      maxFrameMs: sorted.at(-1) ?? null,
      framesOver50Ms: gaps.filter((gap) => gap > 50).length,
      longTasks: recorder.longTasks,
    };
  });
}

/**
 * Timing on the full game screen (seats, record, square fit), not the bare
 * board: keyboard selection samples, a cancelled mouse drag's frame pacing
 * and the fit's response to a viewport resize, all at 4x CPU throttling.
 */
export async function measureChessFrame(
  page: Page,
  info: TestInfo,
  theme: string
) {
  await openChessStory(page, 'screens-games-chess-board--your-turn', theme);
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const selection = await page.evaluate(async () => {
    const source = document.querySelector<HTMLElement>('[data-square="f3"]');
    if (!source) throw new Error('Missing f3');
    const press = (key: string) =>
      source.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    const frames = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    source.focus();
    const samples: { synchronousMs: number; twoFramesMs: number }[] = [];
    let selected = true;
    for (let index = 0; index < 8; index += 1) {
      const start = performance.now();
      press('Enter');
      const synchronousMs = performance.now() - start;
      await frames();
      samples.push({ synchronousMs, twoFramesMs: performance.now() - start });
      selected &&= source.getAttribute('aria-pressed') === 'true';
      press('Escape');
      await frames();
    }
    return { samples, selected };
  });
  expect(selection.selected).toBe(true);

  // A drag that returns to its square: frame pacing with no move committed.
  const from = await squareCenter(page, 'f3');
  const away = await squareCenter(page, 'e5');
  await startRecording(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 30 });
  await page.mouse.move(from.x, from.y, { steps: 30 });
  await page.mouse.up();
  const drag = await stopRecording(page);
  await expect(
    page.getByRole('button', { name: /^f3, White knight/ })
  ).toBeAttached();

  // The square fit recomputes on resize; time it and look for long tasks.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Missing viewport');
  await startRecording(page);
  const resizeStart = await page.evaluate(() => performance.now());
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height - 200,
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      )
  );
  const resizeSettledMs = await page.evaluate(
    (start) => performance.now() - start,
    resizeStart
  );
  await page.setViewportSize(viewport);
  const resize = {
    settledThroughThreeFramesMs: resizeSettledMs,
    ...(await stopRecording(page)),
  };
  await info.attach('frame-performance', {
    body: JSON.stringify(
      {
        story: 'screens-games-chess-board--your-turn',
        cpuThrottle: 4,
        selection,
        drag,
        resize,
        limits:
          'Full game screen in Storybook, desktop Chromium with 4x CPU emulation. Selection is synthetic keyboard events; drag is a Playwright mouse drag returning to its square; resize shrinks the viewport by 200px. Not field INP or a physical device.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await session.detach();
}
