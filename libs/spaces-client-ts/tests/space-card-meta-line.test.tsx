/** @jsxImportSource solid-js */
/** A lobby card: a title over one line of who hosts the space and who is in it. */

import { afterEach, expect, test } from 'bun:test';
import type { SpaceCardData } from '@libs/spaces-client-ts/space-card-view';
import { SpaceCardView } from '@libs/spaces-client-ts/space-card-view';
import {
  FRIEND_SPACE,
  HOSTED_SPACE,
  JOINED_SPACE,
} from '@libs/spaces-client-ts/spaces-story.example';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

/** The text of each caption paragraph on the card, in order. */
function captionLines(space: SpaceCardData): string[] {
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <SpaceCardView space={space} onOpen={() => undefined} />
    </ThemeProvider>
  ));
  return [...container.querySelectorAll('p.textCaption')]
    .filter((p) => p.parentElement?.closest('p.textCaption') === null)
    .map((p) => (p.textContent ?? '').trim());
}

// regression: space-lobby-card-three-grey-lines
test('the host and the guests share one line under the title', () => {
  expect(captionLines(HOSTED_SPACE)).toEqual([
    'Hosted by you · jordan_plays, morgan',
  ]);
});

test('a space with no guests says so on the same line', () => {
  expect(captionLines(FRIEND_SPACE)).toEqual([
    'Hosted by robin_42 · No guests yet',
  ]);
});

test('past two guests, the rest are counted after the line', () => {
  const lines = captionLines(JOINED_SPACE);
  expect(lines[0]).toStartWith('Hosted by sam · avery, jordan_plays');
  expect(lines.at(-1)).toBe(`+${JOINED_SPACE.guests.length - 2} more`);
});
