/**
 * `IconButton` -- a circular button that renders a single child icon or avatar.
 *
 * Uses the themed {@link Pressable} so hover (desktop pointer) and press
 * feedback come from the `interactiveHover` / `interactivePress` overlay
 * tokens.
 * Every button shows a {@link Tooltip} with its `label`.
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

import type { LocalizedString } from '@pkgs/i18n';
import { type ReactNode } from 'react';
import type { PressableProps as RNPressableProps } from 'react-native';
import { OnColorProvider, useTheme } from '../../theme';
import { Pressable } from '../pressable';
import { Tooltip, useTooltipTrigger } from '../tooltip';

export type IconButtonVariant = 'icon' | 'avatar';

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

function iconButtonFaceStyle(args: {
  size: number;
  bg: string;
  isAvatar: boolean;
  disabled: boolean | undefined;
  borderColor: string;
}): Record<string, unknown> {
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
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      opacity: disabled === true ? 0.5 : 1,
      overflow: 'hidden' as const,
    };
  }
  return {
    height: size,
    width: size,
    borderRadius: radius,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: disabled === true ? 0.5 : 1,
  };
}

function IconButtonFace({
  children,
  onPress,
  size,
  background,
  variant,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityRole,
}: Omit<IconButtonProps, 'label'>): ReactNode {
  const theme = useTheme();
  const tooltip = useTooltipTrigger();
  const hasBackground = background !== undefined;
  const bg = resolveBackgroundColor(
    background,
    theme.colors as Record<string, string>
  );
  const isAvatar = variant === 'avatar';
  const radius = size! / 2;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? 'button'}
      onLongPress={() => {
        tooltip?.show();
      }}
      onPressOut={() => {
        tooltip?.hide();
      }}
      sx={{ borderRadius: radius }}
      style={iconButtonFaceStyle({
        size: size!,
        bg,
        isAvatar,
        disabled,
        borderColor: theme.colors.border,
      })}
    >
      {hasBackground && !isAvatar ? (
        <OnColorProvider background={bg}>{children}</OnColorProvider>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function IconButton(props: IconButtonProps): ReactNode {
  const {
    label,
    children,
    onPress,
    size = 40,
    background,
    variant = 'icon',
    disabled = false,
    testID,
    accessibilityLabel,
    accessibilityRole = 'button',
  } = props;

  const resolvedAccessibilityLabel = resolveAccessibilityLabel(
    label,
    accessibilityLabel
  );

  return (
    <Tooltip label={label}>
      <IconButtonFace
        size={size}
        variant={variant}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        {...(background !== undefined ? { background } : {})}
        {...(onPress !== undefined ? { onPress } : {})}
        {...(testID !== undefined ? { testID } : {})}
        {...(resolvedAccessibilityLabel !== undefined
          ? { accessibilityLabel: resolvedAccessibilityLabel }
          : {})}
      >
        {children}
      </IconButtonFace>
    </Tooltip>
  );
}
