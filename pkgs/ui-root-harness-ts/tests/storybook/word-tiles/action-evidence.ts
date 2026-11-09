// @io-wall-ok — automated browser timing adapter, never product code.
import { type Page, test } from '@playwright/test';
import { markEvidencePhase } from './evidence';

/** End-to-end task timing includes automation waits, asserted DOM state and two render opportunities. */
export async function measuredStep(
  page: Page,
  name: string,
  perform: () => Promise<void>
): Promise<void> {
  await test.step(name, async () => {
    await markEvidencePhase(page, `action:${name}`);
    const start = await page.evaluate(() => performance.now());
    await perform();
    await page.evaluate(
      ({ name, start }) =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const samples = (
                window as unknown as { wordTilesSamples?: unknown[] }
              ).wordTilesSamples;
              samples?.push({
                kind: `task:${name}:state-and-two-frames`,
                duration: performance.now() - start,
                startTime: start,
              });
              resolve();
            })
          );
        }),
      { name, start }
    );
  });
}
