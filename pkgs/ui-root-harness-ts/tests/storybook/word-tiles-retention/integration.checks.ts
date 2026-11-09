// @io-wall-ok — verify real Playwright attachment persistence, without a browser.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { retainEvidence } from '../word-tiles/retained-evidence';

// regression: word-tiles-evidence-body-not-retained
test('storybook integration: word-tiles evidence survives the list reporter', async ({}, info) => {
  await retainEvidence(info, 'input-and-long-tasks.json', {
    body: '{"samples":[{"kind":"pointerup-to-frame","duration":16}]}',
    contentType: 'application/json',
  });
  await retainEvidence(info, 'input-and-long-tasks.json', {
    body: '{"samples":[]}',
    contentType: 'application/json',
  });
  const [first, second] = info.attachments;
  expect(first?.path).toBeDefined();
  expect(second?.path).toBeDefined();
  if (!first?.path || !second?.path)
    throw new Error('Evidence was not persisted');
  expect(first.path).not.toEqual(second.path);
  expect(JSON.parse(await readFile(first.path, 'utf8'))).toEqual({
    samples: [{ kind: 'pointerup-to-frame', duration: 16 }],
  });
  expect(JSON.parse(await readFile(second.path, 'utf8'))).toEqual({
    samples: [],
  });
});
