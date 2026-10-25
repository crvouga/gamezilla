import { expect, test } from 'bun:test';
import { i18n } from '@libs/app-root-shared-ts/i18n';

// regression: pong-copy-missing-lingui-catalog
// Literal production ids look up the compiled catalog without a source-text fallback.
test.each([
  ['OKpBfL', 'Pong'],
  ['ym0obM', 'Points to win'],
  ['V0Y6Ky', 'Reconnecting. Controls resume when the game returns.'],
])('Pong catalog key %s resolves to readable English', (id, english) => {
  expect(i18n._(id!)).toBe(english);
});
