// @io-wall-ok — hosted evidence written to the job log, read back from the run itself.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { type Page, test } from '@playwright/test';

/**
 * A diagnostic run that authors references (`--update-snapshots`, used only
 * by the focused Storybook diagnostic job): only then does media go to the
 * log, once per run. The PR gate compares and logs summaries alone. (Turbo
 * does not pass the job's story pattern through to the tests.)
 */
export const diagnosticRun = (): boolean =>
  test.info().config.updateSnapshots !== 'none';

/**
 * One compact JSON summary line, e.g. `PONG_TIMING {...}`. Hosted logs mask a
 * secret whose value is the digit one, so every `1` is written as `~` (absent
 * from base64 and from these values); readers swap it back before parsing.
 */
export function logSummary(tag: string, value: unknown): void {
  process.stdout.write(
    `${tag} ${JSON.stringify(value).replaceAll('1', '~')}\n`
  );
}

const CHUNK = 16_000;

/**
 * Media as base64 chunks with their SHA-256, so a reviewer rebuilds the exact
 * bytes from the job log: `PONG_MEDIA {"name","sha256","bytes","part","of","data"}`.
 */
export function logMedia(name: string, bytes: Uint8Array): void {
  const data = Buffer.from(bytes).toString('base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const of = Math.max(1, Math.ceil(data.length / CHUNK));
  for (let part = 0; part < of; part++)
    logSummary('PONG_MEDIA', {
      name,
      sha256,
      bytes: bytes.length,
      part,
      of,
      data: data.slice(part * CHUNK, (part + 1) * CHUNK),
    });
}

/** A compressed full-page screenshot for the log (diagnostic runs only). */
export async function logScreenshot(page: Page, name: string): Promise<void> {
  if (!diagnosticRun()) return;
  logMedia(
    `${name}.jpg`,
    await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true })
  );
}

/**
 * The test's recorded video, once the page closes (diagnostic runs only).
 * Call last: the page is closed afterwards.
 */
export async function logVideo(page: Page, name: string): Promise<void> {
  if (!diagnosticRun()) return;
  const video = page.video();
  if (!video) throw new Error('Video recording is not enabled for this test');
  await page.close();
  logMedia(`${name}.webm`, await readFile(await video.path()));
}
