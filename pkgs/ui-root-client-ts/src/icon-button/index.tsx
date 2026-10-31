/** @jsxImportSource solid-js */

import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import { children, type JSX, Show } from 'solid-js';
import { OnColorProvider } from '../on-color-context/index';
import { useThemeTokens } from '../theme-context/index';
import type { TooltipPlacement } from '../tooltip/index';
import { Tooltip, useTooltipTrigger } from '../tooltip/index';

export type IconButtonVariant = 'icon' | 'avatar';

/** How the button exposes its `label` as a tooltip. */
export type IconButtonTooltipMode = 'default' | 'hover' | 'none';

/** Border width on each side for `variant="avatar"`. */
export const ICON_BUTTON_AVATAR_BORDER_WIDTH = 2;

/** Minimum pointer target (WCAG 2.5.5 / platform HIG). */
export const ICON_BUTTON_MIN_HIT_TARGET = 44;

/** How long a flashed tooltip stays visible after a click. */
export const ICON_BUTTON_TOOLTIP_FLASH_MS = 1200;

/** Recommended child size for avatar content: `size - border * 2`. */
export function iconButtonAvatarContentSize(size: number): number {
  return size - ICON_BUTTON_AVATAR_BORDER_WIDTH * 2;
}

export type IconButtonProps = {
  /** Tooltip + accessible name. Required: the icon alone names nothing. */
  label: JSX.Element;
  children: JSX.Element;
  onClick?: (() => void) | undefined;
  /** When true, shows the tooltip briefly after `onClick` (touch feedback). */
  flashTooltipOnClick?: boolean | undefined;
  /**
   * Tooltip behavior. Defaults to `'hover'` (pointer only) so programmatic
   * focus never pops a bubble. `'default'` = hover + keyboard `:focus-visible`;
   * `'none'` = no tooltip (label still used for a11y).
   */
  tooltip?: IconButtonTooltipMode | undefined;
  /** Static tooltip placement. Defaults to centered `bottom`. */
  tooltipPlacement?: TooltipPlacement | undefined;
  /** Keep the label visible outside scroll and clipping containers. */
  tooltipFloating?: boolean | undefined;
  /** Visual disc diameter in pixels. Defaults to 40. */
  size?: number | undefined;
  /** Color token for the plate behind the icon. Default: no plate. */
  background?: ColorTokenName | undefined;
  variant?: IconButtonVariant | undefined;
  disabled?: boolean | undefined;
  /** Overrides {@link label} for screen readers only. */
  'aria-label'?: string | undefined;
  /** Popup semantics for menu triggers. */
  'aria-haspopup'?: 'menu' | 'dialog' | 'listbox' | true | undefined;
  'aria-expanded'?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function resolveAriaLabel(
  label: JSX.Element,
  override: string | undefined
): string | undefined {
  if (override !== undefined) return override;
  if (typeof label === 'string' || typeof label === 'number')
    return String(label);
  if (Array.isArray(label))
    return label
      .map((part) => resolveAriaLabel(part, undefined) ?? '')
      .join('');
  if (label !== null && typeof label === 'object' && 'textContent' in label)
    return label.textContent ?? undefined;
  return undefined;
}

function hitBoxClass(): string {
  return 'items-center justify-center rounded-full bg-transparent';
}

/** The hit area grows with the disc but never drops below 44px. */
function hitBoxStyle(size: number): JSX.CSSProperties {
  const hit = Math.max(size, ICON_BUTTON_MIN_HIT_TARGET);
  return { 'min-width': `${hit}px`, 'min-height': `${hit}px` };
}

function discClass(): string {
  return 'items-center justify-center rounded-full';
}

function discStyle(args: {
  size: number;
  bg: string;
  isAvatar: boolean;
  borderColor: string;
}): JSX.CSSProperties {
  // Avatar ring uses padding (not borderWidth) so the disc stays exactly
  // `size` tall — borderWidth inflated the box next to icon siblings.
  if (args.isAvatar) {
    return {
      height: `${args.size}px`,
      'min-width': `${args.size}px`,
      padding: `${ICON_BUTTON_AVATAR_BORDER_WIDTH}px`,
      'background-color': args.borderColor,
      overflow: 'hidden',
    };
  }
  return {
    height: `${args.size}px`,
    width: `${args.size}px`,
    'background-color': args.bg,
  };
}

function IconButtonFace(
  props: IconButtonProps & { tooltipMode: IconButtonTooltipMode }
): JSX.Element {
  const tokens = useThemeTokens();
  const timers = useTimers();
  const tooltip = useTooltipTrigger();
  const label = children(() => props.label);
  const size = (): number => props.size ?? 40;
  const isAvatar = (): boolean => props.variant === 'avatar';
  const hasBackground = (): boolean => props.background !== undefined;
  /** CSS var for the painted disc (tracks live scheme flips). */
  const bgCss = (): string =>
    props.background === undefined
      ? 'transparent'
      : (resolveColor(props.background, tokens.colors) ?? props.background);
  /**
   * Concrete palette color for contrast math. `var(--ui-*)` is unparseable, so
   * feeding it to {@link OnColorProvider} would fall back to ON_DARK and leave
   * light-on-light icons when the fill is a light tint.
   */
  const bgContrast = (): string =>
    props.background === undefined
      ? 'transparent'
      : (resolveColor(props.background, tokens.palette()) ?? 'transparent');

  const handleClick = (): void => {
    props.onClick?.();
    if (props.flashTooltipOnClick === true && tooltip !== null) {
      tooltip.show();
      timers.setTimeout(() => tooltip.hide(), ICON_BUTTON_TOOLTIP_FLASH_MS);
    }
  };

  return (
    <button
      class={`clickable clickableTint ${hitBoxClass()}`}
      classList={{
        'opacity-disabled cursor-not-allowed': props.disabled === true,
      }}
      {...dataAttrs({
        component: 'IconButton',
        variant: props.variant ?? 'icon',
        ...props.dataSet,
      })}
      type="button"
      onClick={handleClick}
      disabled={props.disabled === true}
      aria-label={resolveAriaLabel(label(), props['aria-label'])}
      aria-haspopup={props['aria-haspopup']}
      aria-expanded={props['aria-expanded']}
      aria-describedby={
        tooltip !== null && props.tooltipMode !== 'none'
          ? tooltip.id
          : undefined
      }
      style={hitBoxStyle(size())}
    >
      <div
        class={`box ${discClass()}`}
        data-component="IconButtonDisc"
        style={discStyle({
          size: size(),
          bg: bgCss(),
          isAvatar: isAvatar(),
          borderColor: tokens.colors.border,
        })}
      >
        <Show when={hasBackground() && !isAvatar()} fallback={props.children}>
          <OnColorProvider
            background={bgContrast()}
            backdrop={tokens.palette().background}
          >
            {props.children}
          </OnColorProvider>
        </Show>
      </div>
    </button>
  );
}

/**
 * `IconButton` -- a circular button that renders a single child icon or avatar.
 *
 * The default is the header control: a 40px disc with no plate around a
 * 24px outline icon (pass `size` for dense chrome). `background` puts the
 * icon on a color-token plate (`surfaceMuted` for a secondary control).
 * Hover and press tint the round hit area in 150ms (`.clickableTint`),
 * keyboard focus draws the 2px ring 2px outside it, and `disabled` fades to
 * the disabled opacity.
 *
 * An icon has no visible name, so `label` is a required prop (the type
 * rejects an `IconButton` without one): it names the button for assistive
 * technology, and `aria-label` may override that name with a plain string.
 * By default every
 * button shows a {@link Tooltip} with its `label` on pointer hover only
 * (programmatic focus / modal autofocus never pops a bubble). Pass
 * `tooltip="default"` for hover + keyboard `:focus-visible`, or
 * `tooltip="none"` when a visible caption already labels the control.
 *
 * The `<button>` is the hit target and is never smaller than
 * {@link ICON_BUTTON_MIN_HIT_TARGET} (44px); the visual disc inside is exactly
 * `size` px, so dense chrome keeps its look while touch targets stay legal.
 *
 * `variant="avatar"` draws a border ring via inset padding (so the disc stays
 * exactly `size` tall) and keeps a square hit target via `minWidth`/`height`
 * = `size`. A single face should be sized with
 * {@link iconButtonAvatarContentSize}; wider children (e.g. `AvatarGroup`)
 * expand the button into a pill.
 *
 * @example
 * ```tsx
 * <IconButton label="Close" size={40} onClick={handleClose}>
 *   <XIcon size={18} />
 * </IconButton>
 * ```
 */
export function IconButton(props: IconButtonProps): JSX.Element {
  const tooltipMode = (): IconButtonTooltipMode => props.tooltip ?? 'hover';
  return (
    <Show
      when={tooltipMode() !== 'none'}
      fallback={<IconButtonFace {...props} tooltipMode="none" />}
    >
      <Tooltip
        label={props.label}
        enableFocus={tooltipMode() === 'default'}
        placement={props.tooltipPlacement}
        floating={props.tooltipFloating}
      >
        <IconButtonFace {...props} tooltipMode={tooltipMode()} />
      </Tooltip>
    </Show>
  );
}
