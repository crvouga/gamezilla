/** @jsxImportSource solid-js */
/** The picture on a person's own profile, as a listener hears it. */

import { describe, expect, test } from 'bun:test';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { ProfileAvatarFigure } from '@libs/profile-client-ts/profile-avatar-figure';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { accessibleName } from '@pkgs/a11y-shared-ts/accessible-name';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { imageName } from '@pkgs/a11y-shared-ts/name-rules';
import { roleOf } from '@pkgs/a11y-shared-ts/roles';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from '@solidjs/testing-library';

function pictureHeard(): {
  readonly role: string | null;
  readonly name: string;
} {
  const avatar = document.querySelector('[data-component="Avatar"]');
  if (avatar === null) throw new Error('no avatar drawn');
  const picture = avatar.closest('[role="img"]') ?? avatar;
  return { role: roleOf(picture), name: accessibleName(picture) };
}

describe('profile avatar', () => {
  // regression: a11y-profile-avatar-unnamed
  test('is heard as an image named as the person’s avatar', () => {
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
    render(() => (
      <I18nProvider i18n={i18n}>
        <ThemeProvider colorScheme="light">
          <ProfileAvatarFigure>
            <DeviceAvatar avatarConfig={null} seedFallback="alice" size={96} />
          </ProfileAvatarFigure>
        </ThemeProvider>
      </I18nProvider>
    ));
    const heard = pictureHeard();
    expect(heard.role).toBe('img');
    expect(heard.name.toLowerCase()).toContain('avatar');
    expect(auditTree(document.body, [imageName]).map(formatFailure)).toEqual(
      []
    );
  });
});
