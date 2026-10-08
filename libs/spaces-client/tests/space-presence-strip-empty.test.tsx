/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { SpacePresenceStrip } from '@libs/spaces-client/space-presence-strip';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup, render } from '@solidjs/testing-library';

afterEach(cleanup);

test('before anyone is present the members button shows the people glyph, not an empty disc', () => {
  // regression: space-members-empty-disc
  const { container } = render(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 640 }}>
      <SpacePresenceStrip spaceId="space-1" size={28} />
    </ThemeProvider>
  ));
  expect(container.querySelector('[data-component="AvatarGroup"]')).toBeNull();
  expect(container.querySelector('[data-component="Icon"] svg')).not.toBeNull();
});
