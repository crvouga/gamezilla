import { expect, test } from 'bun:test';
import { classifyLocalStorageFailure } from '../src/local-storage-failure';

// regression: storage-failure-classifier-throws-on-untextable-value
test('a thrown value that cannot become text is classified as unknown', () => {
  expect(classifyLocalStorageFailure([{ toString: 0 }])).toBe('unknown');
  expect(classifyLocalStorageFailure(Object.create(null))).toBe('unknown');
});
