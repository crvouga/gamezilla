import { afterEach, expect, test } from 'bun:test';
import { FriendProfileHeader } from '@libs/friends-client-ts/friend-profile-header';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

test('the primary profile identity exposes the complete valid 32-character username', () => {
  // regression: friend-profile-valid-username-clipped
  const username = 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww';
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ModerationProvider rules={shippedModerationRules()}>
        <FriendProfileHeader
          profile={{
            userId: '5a1e0000-0000-4000-8000-000000000003',
            username,
            avatarConfig: null,
          }}
        />
      </ModerationProvider>
    </ThemeProvider>
  ));
  const identity = screen.getByRole('heading', {
    level: 2,
    name: `@${username}`,
  });
  expect(identity).toHaveTextContent(`@${username}`);
  expect(identity).not.toHaveClass('truncate');
});
