/**
 * `SocialSignInButton` -- branded sign-in button for third-party identity providers.
 *
 * Visual treatment for each provider follows the vendor's published branding
 * guidelines. Layout, palette, padding, label, font, and logo size are all
 * dictated by spec — the only consumer-facing controls are the theme,
 * shape, action (sign in / sign up / continue), and an optional label
 * override for localization.
 *
 * Currently supports:
 * - `provider="google"` — Sign in with Google (Light / Dark / Neutral, Rectangular / Pill).
 *   Per https://developers.google.com/identity/branding-guidelines.
 *
 * @example
 * ```tsx
 * <SocialSignInButton provider="google" onPress={signIn} />
 * <SocialSignInButton provider="google" theme="dark" shape="pill" action="signIn" onPress={signIn} />
 * ```
 */

import type { LocalizedString } from '@gamezilla/i18n';
import { asLocalized } from '@gamezilla/i18n';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BrandIcon } from '../brand-icon';
import { Spinner } from '../spinner';
import { Text } from '../text';
import {
  SOCIAL_PROVIDER_SPECS,
  type SocialProviderSpec,
  type SocialSignInButtonAction,
  type SocialSignInButtonTheme,
  type SocialSignInProvider,
  type SocialThemePalette,
} from './social-provider-config';

export type {
  SocialSignInButtonAction,
  SocialSignInButtonTheme,
  SocialSignInProvider,
} from './social-provider-config';

export type SocialSignInButtonShape = 'rectangular' | 'pill';

export type SocialSignInButtonProps = {
  provider: SocialSignInProvider;
  onPress: () => void;
  /** Visual theme. Defaults to `"light"`. */
  theme?: SocialSignInButtonTheme;
  /** Button shape. Defaults to `"rectangular"`. */
  shape?: SocialSignInButtonShape;
  /** Call-to-action variant. Drives the default label. Defaults to `"continue"`. */
  action?: SocialSignInButtonAction;
  /** Override the rendered label (for localization). */
  label?: ReactNode;
  /** Override the rendered loading label. */
  loadingLabel?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: LocalizedString;
  testID?: string;
};

/**
 * Roboto Medium 14/20 per Google's spec. Other providers we add later may
 * publish different requirements; if they do, move these into the per-
 * provider spec.
 *
 * @see https://developers.google.com/identity/branding-guidelines#font
 */
const FONT_SIZE = 14;
const LINE_HEIGHT = 20;
const FONT_WEIGHT = '500' as const;
/**
 * Best-effort match for the spec'd Roboto Medium without bundling the font.
 * Roboto is the system sans-serif on Android and is included in the standard
 * web stack. iOS falls back to San Francisco, which is the platform-native
 * convention. Apps that need pixel-perfect compliance should load Roboto via
 * `@expo-google-fonts/roboto`.
 */
const FONT_FAMILY = Platform.select({
  android: 'Roboto',
  web: 'Roboto, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  default: undefined,
});

/**
 * Padding spec (Web / mobile + desktop):
 * - 12px before the brand logo
 * - 10px between the logo and the label
 * - 12px after the label
 *
 * @see https://developers.google.com/identity/branding-guidelines#padding
 */
const PADDING_LEFT = 12;
const ICON_GAP = 10;
const PADDING_RIGHT = 12;

const BUTTON_HEIGHT = 40;
const ICON_SIZE = 20;
const STROKE_WIDTH = 1;

const PILL_RADIUS = BUTTON_HEIGHT / 2;
const RECTANGULAR_RADIUS = 4;

function shapeRadius(shape: SocialSignInButtonShape): number {
  return shape === 'pill' ? PILL_RADIUS : RECTANGULAR_RADIUS;
}

function buildPressableStyle({
  palette,
  shape,
  isDisabled,
  pressed,
}: {
  palette: SocialThemePalette;
  shape: SocialSignInButtonShape;
  isDisabled: boolean;
  pressed: boolean;
}): StyleProp<ViewStyle> {
  return {
    height: BUTTON_HEIGHT,
    borderRadius: shapeRadius(shape),
    paddingLeft: PADDING_LEFT,
    paddingRight: PADDING_RIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.fill,
    borderWidth: palette.stroke !== null ? STROKE_WIDTH : 0,
    borderColor: palette.stroke ?? 'transparent',
    opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
  };
}

function SocialSignInLeadingSlot({
  spec,
  palette,
  loading,
}: {
  spec: SocialProviderSpec;
  palette: SocialThemePalette;
  loading: boolean;
}) {
  return (
    <View
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        marginRight: ICON_GAP,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <Spinner size={ICON_SIZE} color={palette.font} />
      ) : (
        <BrandIcon name={spec.brandIcon} size={ICON_SIZE} />
      )}
    </View>
  );
}

export function SocialSignInButton({
  provider,
  onPress,
  theme = 'light',
  shape = 'rectangular',
  action = 'continue',
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  accessibilityHint,
  testID,
}: SocialSignInButtonProps) {
  const { i18n } = useLingui();
  const spec = SOCIAL_PROVIDER_SPECS[provider];
  const palette = spec.themes[theme];
  const isDisabled = loading || disabled;
  const defaultLabel = i18n._(spec.defaultLabels[action]);
  const visibleLabel: ReactNode = loading
    ? (loadingLabel ?? i18n._(spec.loadingLabel))
    : (label ?? defaultLabel);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={asLocalized(defaultLabel)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) =>
        buildPressableStyle({ palette, shape, isDisabled, pressed })
      }
    >
      <SocialSignInLeadingSlot
        spec={spec}
        palette={palette}
        loading={loading}
      />
      <Text
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: FONT_SIZE,
          lineHeight: LINE_HEIGHT,
          fontWeight: FONT_WEIGHT,
          color: palette.font,
        }}
        label={visibleLabel}
      />
    </Pressable>
  );
}
