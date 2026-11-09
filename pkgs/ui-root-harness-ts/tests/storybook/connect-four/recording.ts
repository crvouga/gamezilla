// @io-wall-ok — validate bytes emitted by the owned browser recording adapter.
import { readFile } from 'node:fs/promises';
import {
  type Browser,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test';

/** Inspect the actual encoded WebM, not a copy of the requested configuration. */
export async function verifyRecordingCanvas(
  browser: Browser,
  page: Page,
  info: TestInfo
) {
  const expected = page.viewportSize();
  const video = page.video();
  if (!video || !expected) throw new Error('Missing viewport recording');
  await page.close();
  const path = info.outputPath('recording-canvas.webm');
  await video.saveAs(path);
  const bytes = await readFile(path);
  const inspection = await browser.newPage();
  try {
    await inspection.route('**/*', (route) =>
      route.fulfill({ body: bytes, contentType: 'video/webm' })
    );
    await inspection.setContent(
      '<video src="https://recording.invalid/capture.webm" preload="metadata"></video>'
    );
    const player = inspection.locator('video');
    await expect
      .poll(() =>
        player.evaluate((element) =>
          element instanceof HTMLVideoElement ? element.videoWidth : 0
        )
      )
      .toBe(expected.width);
    await expect
      .poll(() =>
        player.evaluate((element) =>
          element instanceof HTMLVideoElement ? element.videoHeight : 0
        )
      )
      .toBe(expected.height);
    await info.attach('recording-canvas', {
      body: JSON.stringify({ ...expected, bytes: bytes.byteLength }),
      contentType: 'application/json',
    });
  } finally {
    await inspection.close();
  }
}
