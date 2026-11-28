/** @jsxImportSource @solidjs/web */
/**
 * Per-provider visual + copy specs for `SocialSignInButton`.
 *
 * (`.tsx` so the Lingui `msg` macro is compiled by the Solid/Babel pipeline.)
 *
 * Each entry encodes the requirements published by the identity provider's
 * branding guidelines. Editing these values means breaking the contract with
 * that vendor's design rules — only do so when a guideline changes upstream.
 *
 * @see https://developers.google.com/identity/branding-guidelines (Google)
 * @see https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple (Apple)
 */

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { BrandIconName } from '../brand-icon-registry';

export type SocialSignInProvider = 'google' | 'apple' | 'dev';

/**
 * Call-to-action variant. Drives the default localized label per provider.
 *
 * Google's guidelines explicitly recommend "Sign in with Google", "Sign up
 * with Google", or "Continue with Google".
 */
export type SocialSignInButtonAction = 'signIn' | 'signUp' | 'continue';

export type SocialButtonPalette = {
  fill: string;
  /** Border color, or `null` when the provider's spec omits a stroke. */
  stroke: string | null;
  font: string;
};

export type SocialProviderSpec = {
  brandIcon: BrandIconName;
  palette: SocialButtonPalette;
  defaultLabels: Record<SocialSignInButtonAction, MessageDescriptor>;
  /** Label rendered while `loading` is true. */
  loadingLabel: MessageDescriptor;
};

/**
 * Google "Sign in with Google" dark button (
 * 1px inside stroke, Google Sans Medium 14/20).
 *
 * @see https://developers.google.com/identity/branding-guidelines#color
 */
const GOOGLE_SPEC: SocialProviderSpec = {
  brandIcon: 'google',
  palette: { fill: '#131314', stroke: '#8E918F', font: '#E3E3E3' },
  defaultLabels: {
    signIn: msg`Sign in with Google`,
    signUp: msg`Sign up with Google`,
    continue: msg`Continue with Google`,
  },
  loadingLabel: msg`Signing in…`,
};

/**
 * Apple’s white button for a dark background. Its mark takes the label color.
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
 */
const APPLE_SPEC: SocialProviderSpec = {
  brandIcon: 'apple',
  palette: { fill: '#FFFFFF', stroke: null, font: '#000000' },
  defaultLabels: {
    signIn: msg`Sign in with Apple`,
    signUp: msg`Sign up with Apple`,
    continue: msg`Continue with Apple`,
  },
  loadingLabel: msg`Signing in…`,
};

/**
 * In-repo "Dev IdP" branding spec. Mirrors Google's button layout so the
 * dev account chooser feels like a real social IdP entry point, but uses
 * the application palette and flask mark so it can never be confused
 * for a production provider.
 */
const DEV_SPEC: SocialProviderSpec = {
  brandIcon: 'dev',
  palette: {
    fill: 'var(--ui-color-surface)',
    stroke: 'var(--ui-color-outline)',
    font: 'var(--ui-color-text)',
  },
  defaultLabels: {
    signIn: msg`Sign in with dev IDP`,
    signUp: msg`Sign up with dev IDP`,
    continue: msg`Continue with dev IDP`,
  },
  loadingLabel: msg`Signing in…`,
};

export const SOCIAL_PROVIDER_SPECS = {
  google: GOOGLE_SPEC,
  apple: APPLE_SPEC,
  dev: DEV_SPEC,
} as const satisfies Record<SocialSignInProvider, SocialProviderSpec>;
