// @io-wall-ok — verifies the exact files retained by the CI evidence uploader.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { auditHearts, captureHearts, openHearts } from '../evidence';

test.use({ video: 'on', trace: 'on' });

// regression: hearts-evidence-body-attachments-not-retained
test('storybook integration: Hearts retains PNG and accessibility JSON as artifact files', async ({
  page,
}, info) => {
  await openHearts(page, 'screens-games-hearts-board--passing', 'light');
  await captureHearts(page, info, 'retained-hand');
  await auditHearts(page, info);
  const image = await readFile(info.outputPath('retained-hand.png'));
  expect(image.subarray(1, 4).toString()).toBe('PNG');
  const axe = JSON.parse(
    await readFile(info.outputPath('axe-results.json'), 'utf8')
  );
  if (typeof axe !== 'object' || axe === null || !('violations' in axe))
    throw new Error('Retained accessibility report has no violations list');
  expect(Array.isArray(axe.violations)).toBe(true);
  expect(
    await readFile(
      info.outputPath('retained-hand-accessibility-tree.txt'),
      'utf8'
    )
  ).toContain('Your hand');
});
