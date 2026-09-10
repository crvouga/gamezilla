/** @jsxImportSource solid-js */
/**
 * `IconButton` -- a circular button that renders a single child icon or avatar.
 *
 * Uses {@link Clickable} so hover / press feedback come from the
 * `interactiveHover` / `interactivePress` overlay tokens. By default every
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

import { useTimers } from '@pkgs/clock/solid';
import { type JSX, Show, untrack } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { OnColorProvider, resolveColor, useThemeTokens } from '../../theme';
import { Tooltip, useTooltipTrigger } from '../tooltip';

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
  /** Tooltip + default accessible name. */
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
  /** Visual disc diameter in pixels. Defaults to 40. */
  size?: number | undefined;
  /** Color token or raw color for the background. */
  background?: string | undefined;
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
  if (typeof label === 'string') return label;
  return undefined;
}

function hitBoxClass(): string {
  return 'items-center justify-center rounded-[9999px] bg-transparent';
}

function hitBoxStyle(size: number, disabled: boolean): JSX.CSSProperties {
  const hit = Math.max(size, ICON_BUTTON_MIN_HIT_TARGET);
  return {
    'min-width': `${hit}px`,
    'min-height': `${hit}px`,
    opacity: disabled ? 0.5 : 1,
  };
}

function discClass(): string {
  return 'items-center justify-center';
}

function discStyle(args: {
  size: number;
  bg: string;
  isAvatar: boolean;
  borderColor: string;
}): JSX.CSSProperties {
  const radius = args.size / 2;
  // Avatar ring uses padding (not borderWidth) so the disc stays exactly
  // `size` tall — borderWidth inflated the box next to icon siblings.
  if (args.isAvatar) {
    return {
      height: `${args.size}px`,
      'min-width': `${args.size}px`,
      padding: `${ICON_BUTTON_AVATAR_BORDER_WIDTH}px`,
      'border-radius': `${radius}px`,
      'background-color': args.borderColor,
      overflow: 'hidden',
    };
  }
  return {
    height: `${args.size}px`,
    width: `${args.size}px`,
    'border-radius': `${radius}px`,
    'background-color': args.bg,
  };
}

function IconButtonFace(
  props: IconButtonProps & { tooltipMode: IconButtonTooltipMode }
): JSX.Element {
  const tokens = useThemeTokens();
  const timers = useTimers();
  const tooltip = useTooltipTrigger();
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
    // Event handlers have no Solid owner — untrack prop reads so parent
    // accessors (e.g. ActionBar `<For>` items) do not mint orphaned memos.
    const onClick = untrack(() => props.onClick);
    const flash = untrack(() => props.flashTooltipOnClick === true);
    onClick?.();
    if (flash && tooltip !== null) {
      tooltip.show();
      timers.setTimeout(() => tooltip.hide(), ICON_BUTTON_TOOLTIP_FLASH_MS);
    }
  };

  return (
    <button
      class={`clickable clickableTint ${hitBoxClass()}`}
      {...dataAttrs({
        component: 'IconButton',
        variant: props.variant ?? 'icon',
        ...props.dataSet,
      })}
      type="button"
      onClick={handleClick}
      disabled={props.disabled === true}
      aria-label={resolveAriaLabel(props.label, props['aria-label'])}
      aria-haspopup={props['aria-haspopup']}
      aria-expanded={props['aria-expanded']}
      aria-describedby={
        tooltip !== null && props.tooltipMode !== 'none'
          ? tooltip.id
          : undefined
      }
      style={hitBoxStyle(size(), props.disabled === true)}
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

export function IconButton(props: IconButtonProps): JSX.Element {
  const tooltipMode = (): IconButtonTooltipMode => props.tooltip ?? 'hover';
  return (
    <Show
      when={tooltipMode() !== 'none'}
      fallback={<IconButtonFace {...props} tooltipMode="none" />}
    >
      <Tooltip label={props.label} enableFocus={tooltipMode() === 'default'}>
        <IconButtonFace {...props} tooltipMode={tooltipMode()} />
      </Tooltip>
    </Show>
  );
}
