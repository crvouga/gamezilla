/** @jsxImportSource solid-js */
/**
 * `IconButton` -- a circular button that renders a single child icon or avatar.
 *
 * Uses {@link Clickable} so hover / press feedback come from the
 * `interactiveHover` / `interactivePress` overlay tokens. By default every
 * button shows a {@link Tooltip} with its `label` (hover + keyboard focus).
 * Pass `tooltip="hover"` for pointer-hover only, or `tooltip="none"` when a
 * visible caption already labels the control.
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
import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import {
  OnColorProvider,
  resolveColor,
  type SxProps,
  useThemeTokens,
} from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
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
   * Tooltip behavior. `'default'` = hover + focus; `'hover'` = pointer hover
   * only; `'none'` = no tooltip (label still used for a11y).
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

function hitBoxSx(size: number, disabled: boolean): SxProps {
  const hit = Math.max(size, ICON_BUTTON_MIN_HIT_TARGET);
  return {
    minWidth: hit,
    minHeight: hit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'full',
    backgroundColor: 'transparent',
    opacity: disabled ? 0.5 : 1,
  };
}

function discSx(args: {
  size: number;
  bg: string;
  isAvatar: boolean;
  borderColor: string;
}): SxProps {
  const radius = args.size / 2;
  // Avatar ring uses padding (not borderWidth) so the disc stays exactly
  // `size` tall — borderWidth inflated the box next to icon siblings.
  if (args.isAvatar) {
    return {
      height: args.size,
      minWidth: args.size,
      padding: ICON_BUTTON_AVATAR_BORDER_WIDTH,
      borderRadius: radius,
      backgroundColor: args.borderColor,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    };
  }
  return {
    height: args.size,
    width: args.size,
    borderRadius: radius,
    backgroundColor: args.bg,
    alignItems: 'center',
    justifyContent: 'center',
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
  const bg = (): string =>
    props.background === undefined
      ? 'transparent'
      : (resolveColor(props.background, tokens.colors) ?? props.background);

  const handleClick = (): void => {
    props.onClick?.();
    if (props.flashTooltipOnClick === true && tooltip !== null) {
      tooltip.show();
      timers.setTimeout(() => tooltip.hide(), ICON_BUTTON_TOOLTIP_FLASH_MS);
    }
  };

  return (
    <Clickable
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
      dataSet={{
        component: 'IconButton',
        variant: props.variant ?? 'icon',
        ...props.dataSet,
      }}
      sx={hitBoxSx(size(), props.disabled === true)}
    >
      <Box
        dataSet={{ component: 'IconButtonDisc' }}
        sx={discSx({
          size: size(),
          bg: bg(),
          isAvatar: isAvatar(),
          borderColor: tokens.colors.border,
        })}
      >
        <Show when={hasBackground() && !isAvatar()} fallback={props.children}>
          <OnColorProvider background={bg()}>{props.children}</OnColorProvider>
        </Show>
      </Box>
    </Clickable>
  );
}

export function IconButton(props: IconButtonProps): JSX.Element {
  const tooltipMode = (): IconButtonTooltipMode => props.tooltip ?? 'default';
  return (
    <Show
      when={tooltipMode() !== 'none'}
      fallback={<IconButtonFace {...props} tooltipMode="none" />}
    >
      <Tooltip label={props.label}>
        <IconButtonFace {...props} tooltipMode={tooltipMode()} />
      </Tooltip>
    </Show>
  );
}
