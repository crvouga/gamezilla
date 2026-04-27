/**
 * Per-provider visual + copy specs for {@link SocialSignInButton}.
 *
 * Each entry encodes the requirements published by the identity provider's
 * branding guidelines. Editing these values means breaking the contract with
 * that vendor's design rules — only do so when a guideline changes upstream.
 *
 * @see https://developers.google.com/identity/branding-guidelines (Google)
 */

import type { BrandIconName } from '../brand-icon';

export type SocialSignInProvider = 'google';

export type SocialSignInButtonTheme = 'light' | 'dark' | 'neutral';

/**
 * Call-to-action variant. Drives the default localized label per provider.
 *
 * Google's guidelines explicitly recommend "Sign in with Google", "Sign up
 * with Google", or "Continue with Google".
 */
export type SocialSignInButtonAction = 'signIn' | 'signUp' | 'continue';

export type SocialThemePalette = {
  fill: string;
  /** Border color, or `null` when the provider's spec omits a stroke. */
  stroke: string | null;
  font: string;
};

export type SocialProviderSpec = {
  brandIcon: BrandIconName;
  themes: Record<SocialSignInButtonTheme, SocialThemePalette>;
  defaultLabels: Record<SocialSignInButtonAction, string>;
  /** Label rendered while `loading` is true. */
  loadingLabel: string;
};

/**
 * Google "Sign in with Google" branding spec (Light / Dark / Neutral themes,
 * 1px inside stroke, Roboto Medium 14/20).
 *
 * @see https://developers.google.com/identity/branding-guidelines#color
 */
const GOOGLE_SPEC: SocialProviderSpec = {
  brandIcon: 'google',
  themes: {
    light: { fill: '#FFFFFF', stroke: '#747775', font: '#1F1F1F' },
    dark: { fill: '#131314', stroke: '#8E918F', font: '#E3E3E3' },
    neutral: { fill: '#F2F2F2', stroke: null, font: '#1F1F1F' },
  },
  defaultLabels: {
    signIn: 'Sign in with Google',
    signUp: 'Sign up with Google',
    continue: 'Continue with Google',
  },
  loadingLabel: 'Signing in…',
};

export const SOCIAL_PROVIDER_SPECS = {
  google: GOOGLE_SPEC,
} as const satisfies Record<SocialSignInProvider, SocialProviderSpec>;
