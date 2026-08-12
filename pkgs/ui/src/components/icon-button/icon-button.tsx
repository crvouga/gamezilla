/**
 * `IconButton` -- a circular button that renders a single child icon or avatar.
 *
 * Uses the themed {@link Pressable} so hover (desktop pointer) and press
 * feedback come from the `interactiveHover` / `interactivePress` overlay
 * tokens.
 * By default every button shows a {@link Tooltip} with its `label`. Pass
 * `tooltip="hover"` for pointer-hover only (no long-press), or
 * `tooltip="none"` when a visible caption already labels the control.
 *
 * `variant="avatar"` draws a border ring via inset padding (so the outer
 * box stays exactly `size` tall) and keeps a square hit target via
 * `minWidth`/`height` = `size`. A single face should be sized with
 * {@link iconButtonAvatarContentSize}; wider children (e.g. `AvatarGroup`)
 * expand the button into a pill.
 *
 * @example
 * ```tsx
 * <IconButton label="Close" size={40} onPress={handleClose}>
 *   <XIcon size={18} />
 * </IconButton>
 * ```
 */

import { useTimers } from '@pkgs/clock';
import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import type { PressableProps as RNPressableProps } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import { OnColorProvider, type SxProps, useTheme } from '../../theme';
import { Pressable } from '../pressable';
import { Tooltip, useTooltipTrigger } from '../tooltip';

export type IconButtonVariant = 'icon' | 'avatar';

/** How the button exposes its `label` as a tooltip. */
export type IconButtonTooltipMode = 'default' | 'hover' | 'none';

/** Border width on each side for `variant="avatar"`. */
export const ICON_BUTTON_AVATAR_BORDER_WIDTH = 2;

/** Recommended child size for avatar content: `size - border * 2`. */
export function iconButtonAvatarContentSize(size: number): number {
  return size - ICON_BUTTON_AVATAR_BORDER_WIDTH * 2;
}

export type IconButtonProps = {
  /** Tooltip + default accessibility label. */
  label: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  /** When true, shows the tooltip briefly after `onPress` (touch feedback). */
  flashTooltipOnPress?: boolean;
  /**
   * Tooltip behavior. `'default'` = hover + long-press; `'hover'` = pointer
   * hover only; `'none'` = no tooltip (label still used for a11y).
   */
  tooltip?: IconButtonTooltipMode;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  /** Color token or raw color for the background. */
  background?: string;
  variant?: IconButtonVariant;
  disabled?: boolean;
  testID?: string;
  /** Overrides {@link label} for screen readers only. */
  accessibilityLabel?: LocalizedString;
  accessibilityRole?: RNPressableProps['accessibilityRole'];
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function resolveAccessibilityLabel(
  label: ReactNode,
  override: LocalizedString | undefined
): LocalizedString | undefined {
  if (override !== undefined) return override;
  if (typeof label === 'string') return label as LocalizedString;
  return undefined;
}

function resolveBackgroundColor(
  background: string | undefined,
  colors: Record<string, string>
): string {
  if (background === undefined) return 'transparent';
  return colors[background] ?? background;
}

function iconButtonFaceSx(args: {
  size: number;
  bg: string;
  isAvatar: boolean;
  disabled: boolean | undefined;
  borderColor: string;
}): SxProps {
  const { size, bg, isAvatar, disabled, borderColor } = args;
  const radius = size / 2;
  // Avatar ring uses padding (not borderWidth) so the outer box stays exactly
  // `size` tall on web and native — borderWidth was inflating the box and
  // making avatar buttons look shifted down next to icon siblings.
  if (isAvatar) {
    return {
      height: size,
      minWidth: size,
      padding: ICON_BUTTON_AVATAR_BORDER_WIDTH,
      borderRadius: radius,
      backgroundColor: borderColor,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled === true ? 0.5 : 1,
      overflow: 'hidden',
    };
  }
  return {
    height: size,
    width: size,
    borderRadius: radius,
    backgroundColor: bg,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled === true ? 0.5 : 1,
  };
}

type IconButtonFaceProps = Omit<
  IconButtonProps,
  'label' | 'tooltip' | 'children'
> & {
  tooltipMode: IconButtonTooltipMode;
  children: ReactNode;
};

function IconButtonFace({
  children,
  onPress,
  flashTooltipOnPress,
  tooltipMode,
  size,
  background,
  variant,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityRole,
  dataSet,
}: IconButtonFaceProps): ReactNode {
  const theme = useTheme();
  const timers = useTimers();
  const tooltip = useTooltipTrigger();
  const hasBackground = background !== undefined;
  const bg = resolveBackgroundColor(
    background,
    theme.colors as Record<string, string>
  );
  const isAvatar = variant === 'avatar';
  const radius = size! / 2;
  const longPressTooltip = tooltipMode === 'default';

  const handlePress = onPress
    ? () => {
        onPress();
        if (flashTooltipOnPress === true && tooltipMode !== 'none') {
          timers.setTimeout(() => tooltip?.show(), 0);
        }
      }
    : undefined;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? 'button'}
      dataSet={{ component: 'IconButton', ...dataSet }}
      {...(longPressTooltip
        ? {
            onLongPress: () => {
              tooltip?.show();
            },
            onPressOut: () => {
              tooltip?.hide();
            },
          }
        : {})}
      sx={[
        { borderRadius: radius },
        iconButtonFaceSx({
          size: size!,
          bg,
          isAvatar,
          disabled,
          borderColor: theme.colors.border,
        }),
      ]}
    >
      {hasBackground && !isAvatar ? (
        <OnColorProvider background={bg}>{children}</OnColorProvider>
      ) : (
        children
      )}
    </Pressable>
  );
}

type IconButtonFaceBaseProps = Omit<IconButtonFaceProps, 'children'>;

function buildIconButtonFaceProps(
  props: IconButtonProps,
  tooltipMode: IconButtonTooltipMode
): IconButtonFaceBaseProps {
  const {
    label,
    accessibilityLabel,
    onPress,
    flashTooltipOnPress,
    background,
    testID,
    size = 40,
    variant = 'icon',
    disabled = false,
    accessibilityRole = 'button',
  } = props;
  const resolvedA11y = resolveAccessibilityLabel(label, accessibilityLabel);
  return {
    size,
    variant,
    disabled,
    accessibilityRole,
    tooltipMode,
    ...(background !== undefined ? { background } : {}),
    ...(onPress !== undefined ? { onPress } : {}),
    ...(flashTooltipOnPress === true ? { flashTooltipOnPress } : {}),
    ...(testID !== undefined ? { testID } : {}),
    ...(resolvedA11y !== undefined ? { accessibilityLabel: resolvedA11y } : {}),
  };
}

export function IconButton(props: IconButtonProps): ReactNode {
  const tooltipMode = props.tooltip ?? 'default';
  const face = (
    <IconButtonFace
      {...buildIconButtonFaceProps(props, tooltipMode)}
      {...(props.dataSet !== undefined ? { dataSet: props.dataSet } : {})}
    >
      {props.children}
    </IconButtonFace>
  );
  if (tooltipMode === 'none') return face;
  return <Tooltip label={props.label}>{face}</Tooltip>;
}
