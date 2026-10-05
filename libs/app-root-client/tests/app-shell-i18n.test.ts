import { expect, test } from 'bun:test';
import '@libs/app-root-client/app-shell-provider';
import { i18n } from '@lingui/core';

// regression: inactive-i18n-blank-app-shell
test('loading the app shell activates its locale before the provider mounts', () => {
  expect(i18n.locale).toBe('en');
});
