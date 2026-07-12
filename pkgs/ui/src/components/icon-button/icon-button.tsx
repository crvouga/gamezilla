/**
 * `IconButton` -- a circular button that renders a single child icon or avatar.
 *
 * Uses the themed {@link Pressable} so hover (web) and press feedback come
 * from the `interactiveHover` / `interactivePress` overlay tokens.
 * Every button shows a {@link Tooltip} with its `label`.
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
  const bg = hasBackground
    ? (theme.colors[background as keyof typeof theme.colors] ?? background)
    : 'transparent';
  const radius = size! / 2;
  const isAvatar = variant === 'avatar';

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
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: isAvatar ? 'transparent' : bg,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        opacity: disabled ? 0.5 : 1,
        overflow: isAvatar ? ('hidden' as const) : undefined,
        ...(isAvatar
          ? {
              borderWidth: ICON_BUTTON_AVATAR_BORDER_WIDTH,
              borderColor: theme.colors.surface,
            }
          : {}),
      }}
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
