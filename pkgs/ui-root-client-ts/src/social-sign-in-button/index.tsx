/** @jsxImportSource solid-js */

import './google-font.css';

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { BrandIcon } from '../brand-icon/index';
import type {
  SocialProviderSpec,
  SocialSignInButtonAction,
  SocialSignInButtonTheme,
  SocialSignInProvider,
  SocialThemePalette,
} from '../social-provider-config/index';
import { SOCIAL_PROVIDER_SPECS } from '../social-provider-config/index';
import { Spinner } from '../spinner/index';

export type SocialSignInButtonShape = 'rectangular' | 'pill';

export type SocialSignInButtonProps = {
  provider: SocialSignInProvider;
  onClick: () => void;
  /** Visual theme. Defaults to `"light"`. */
  theme?: SocialSignInButtonTheme | undefined;
  /** Button shape. Defaults to `"rectangular"`. */
  shape?: SocialSignInButtonShape | undefined;
  /** Call-to-action variant. Drives the default label. Defaults to `"continue"`. */
  action?: SocialSignInButtonAction | undefined;
  /** Override the rendered label (for localization). */
  label?: JSX.Element | undefined;
  /** Override the rendered loading label. */
  loadingLabel?: JSX.Element | undefined;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Extra description for assistive tech. */
  'aria-describedby'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Google Sans Medium 14/20 per Google's spec.
 * @see https://developers.google.com/identity/branding-guidelines#font
 */
const FONT_SIZE = 14;
const LINE_HEIGHT = 20;
const FONT_WEIGHT = '500' as const;
/** Self-hosted vendor typeface, isolated to social sign-in controls. */
const FONT_FAMILY = '"Google Sans", system-ui, sans-serif';

/**
 * Padding spec: 12px before the logo, 10px logo→label, 12px after the label.
 * @see https://developers.google.com/identity/branding-guidelines#padding
 */
const PADDING_LEFT = 12;
const ICON_GAP = 10;
const PADDING_RIGHT = 12;

export const SOCIAL_BUTTON_HEIGHT = 40;
const ICON_SIZE = 20;
const STROKE_WIDTH = 1;

const PILL_RADIUS = SOCIAL_BUTTON_HEIGHT / 2;
const RECTANGULAR_RADIUS = 4;

export function socialShapeRadius(shape: SocialSignInButtonShape): number {
  return shape === 'pill' ? PILL_RADIUS : RECTANGULAR_RADIUS;
}

function buttonClass(): string {
  return 'flex-row items-center justify-center';
}

function buttonStyle(args: {
  palette: SocialThemePalette;
  shape: SocialSignInButtonShape;
  isDisabled: boolean;
}): JSX.CSSProperties {
  return {
    height: `${SOCIAL_BUTTON_HEIGHT}px`,
    'border-radius': `${socialShapeRadius(args.shape)}px`,
    'padding-left': `${PADDING_LEFT}px`,
    'padding-right': `${PADDING_RIGHT}px`,
    'background-color': args.palette.fill,
    'border-width': `${args.palette.stroke !== null ? STROKE_WIDTH : 0}px`,
    'border-style': 'solid',
    'border-color': args.palette.stroke ?? 'transparent',
    opacity: args.isDisabled ? 0.5 : 1,
  };
}

function LeadingSlot(props: {
  spec: SocialProviderSpec;
  palette: SocialThemePalette;
  loading: boolean;
}): JSX.Element {
  return (
    <div
      class="box items-center justify-center"
      style={{
        width: `${ICON_SIZE}px`,
        height: `${ICON_SIZE}px`,
        'margin-right': `${ICON_GAP}px`,
        // Monochrome marks (Apple's) draw in the label's color.
        color: props.palette.font,
      }}
    >
      <Show
        when={props.loading}
        fallback={<BrandIcon name={props.spec.brandIcon} size={ICON_SIZE} />}
      >
        <Spinner decorative size="sm" color="current" />
      </Show>
    </div>
  );
}

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
 * - `provider="dev"` — in-repo Dev IdP (non-production builds only).
 *
 * @example
 * ```tsx
 * <SocialSignInButton provider="google" onClick={signIn} />
 * <SocialSignInButton provider="google" theme="dark" shape="pill" action="signIn" onClick={signIn} />
 * ```
 */
export function SocialSignInButton(
  props: SocialSignInButtonProps
): JSX.Element {
  const { i18n } = useLingui();
  const spec = (): SocialProviderSpec => SOCIAL_PROVIDER_SPECS[props.provider];
  const palette = (): SocialThemePalette =>
    spec().themes[props.theme ?? 'light'];
  const loading = (): boolean => props.loading === true;
  const isDisabled = (): boolean => loading() || props.disabled === true;
  const defaultLabel = (): string =>
    i18n()._(spec().defaultLabels[props.action ?? 'continue']);
  const visibleLabel = (): JSX.Element =>
    loading()
      ? (props.loadingLabel ?? i18n()._(spec().loadingLabel))
      : (props.label ?? defaultLabel());

  return (
    <button
      class={`clickable clickableOpacity ${buttonClass()}`}
      {...dataAttrs({
        component: 'SocialSignInButton',
        provider: props.provider,
        ...props.dataSet,
      })}
      type="button"
      onClick={() => props.onClick()}
      disabled={isDisabled()}
      aria-label={defaultLabel()}
      aria-busy={loading() ? true : undefined}
      aria-describedby={props['aria-describedby']}
      style={buttonStyle({
        palette: palette(),
        shape: props.shape ?? 'rectangular',
        isDisabled: isDisabled(),
      })}
    >
      <LeadingSlot spec={spec()} palette={palette()} loading={loading()} />
      <p
        class="text whitespace-nowrap"
        style={{
          'font-size': `${FONT_SIZE}px`,
          'line-height': `${LINE_HEIGHT}px`,
          'font-weight': FONT_WEIGHT,
          color: palette().font,
          'font-family':
            props.provider === 'google' ? FONT_FAMILY : 'var(--ui-font-sans)',
        }}
      >
        {visibleLabel()}
      </p>
    </button>
  );
}
