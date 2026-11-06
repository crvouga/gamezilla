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

/** The card's second line: its caption texts and how many faces it shows. */
function metaLine(space: SpaceCardData): {
  captions: string[];
  faces: number;
  overflow: string | null;
  oneRow: boolean;
} {
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <SpaceCardView space={space} onOpen={() => undefined} />
    </ThemeProvider>
  ));
  const captions = [...container.querySelectorAll('p.textCaption')].filter(
    (p) => p.parentElement?.closest('p.textCaption') === null
  );
  const group = container.querySelector('[data-component="AvatarGroup"]');
  const row = captions[0]?.parentElement?.parentElement ?? null;
  const parts = [...captions, ...(group === null ? [] : [group])];
  return {
    captions: captions.map((p) => (p.textContent ?? '').trim()),
    faces: group?.querySelectorAll('[data-component="Avatar"]').length ?? 0,
    overflow:
      group === null
        ? null
        : (group.lastElementChild?.textContent ?? '').trim() || null,
    oneRow: row !== null && parts.every((part) => row.contains(part)),
  };
}

// regression: space-lobby-card-three-grey-lines
test('the host and the guests share one line under the title', () => {
  const line = metaLine(HOSTED_SPACE);
  expect(line.captions).toEqual(['Hosted by you']);
  expect(line.faces).toBe(HOSTED_SPACE.guests.length);
  expect(line.oneRow).toBe(true);
});

test('a space with no guests says so on the same line', () => {
  const line = metaLine(FRIEND_SPACE);
  expect(line.captions).toEqual(['Hosted by robin_42', 'No guests yet']);
  expect(line.faces).toBe(0);
  expect(line.oneRow).toBe(true);
});

// regression: space-lobby-guest-line-breaks-mid-list
// regression: space-lobby-host-and-guests-truncate-together
test('the host is its own phrase; the guests are a few faces and a count', () => {
  // Never one sentence that a narrow card cuts off ("robin_42 and …"): the
  // host keeps its own words, and the guests show as faces, then "+N".
  const line = metaLine(JOINED_SPACE);
  expect(line.captions).toEqual(['Hosted by sam']);
  expect(line.faces).toBe(3);
  expect(line.overflow).toBe(`+${JOINED_SPACE.guests.length - 3}`);
  expect(line.oneRow).toBe(true);
});
