/**
 * `Button` -- themed pressable with three intents, three sizes, three variants.
 *
 * Solid fills use a chess.com-style top→bottom candy gradient and inset bevel
 * derived from the intent source color. Labels use dedicated `on*` foreground
 * tokens so contrast stays high in both schemes.
 *
 * `intent` chooses the color role (primary / danger / neutral); `variant`
 * chooses how much visual weight that color carries:
 *   - `solid` (default) -- gradient fill + `on*` label, looks like the
 *     primary action.
 *   - `outline` -- transparent bg + colored border + intent-colored label.
 *   - `ghost` -- transparent bg, no border, intent-colored label, gets a
 *     subtle interactive overlay on hover/press.
 *
 * Hover/press feedback is delegated to {@link Pressable}'s tint overlay,
 * so the same interaction language is consistent across every pressable
 * surface in the system.
 *
 * @example
 * ```tsx
 * <Button title="Save" intent="primary" onPress={save} />
 * <Button title="Delete" intent="danger" onPress={del} />
 * <Button title="Cancel" intent="neutral" variant="outline" onPress={cancel} />
 * <Button title="Skip" intent="neutral" variant="ghost" onPress={skip} />
 * ```
 */

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Platform, View } from 'react-native';
import { OnColorProvider, useTheme, type Theme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { XIcon, type IconComponent, type IconProps } from '../icons';
import { Text } from '../text';
import { ButtonSurfaceFill } from './button-surface-fill';
import {
  MUTATION_FEEDBACK_ICONS,
  mutationPressableForegroundColor,
  resolveMutationPressableRender,
  type ButtonFeedback,
  type ButtonIntent,
  type ButtonVariant,
  type MutationPressableFace,
} from './mutation-pressable-face';

export type { ButtonFeedback, ButtonIntent, ButtonVariant };

export type ButtonProps = {
  title: ReactNode;
  onPress?: () => void;
  intent?: ButtonIntent;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  feedback?: ButtonFeedback;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
  onRetry?: () => void;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  flex?: number;
};

export type ButtonSize = 'sm' | 'md' | 'lg';

const sizeMap = {
  sm: {
    py: 1.5,
    px: 3,
    borderRadius: borderRadius.md,
    minHeight: 32,
    text: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
    iconSize: 18,
    iconStrokeWidth: 2.75,
    iconGap: 1.5,
  },
  md: {
    py: 2.5,
    px: 4,
    borderRadius: borderRadius.md,
    minHeight: 40,
    text: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
    iconSize: 22,
    iconStrokeWidth: 2.75,
    iconGap: 2,
  },
  lg: {
    py: 3,
    px: 5,
    borderRadius: borderRadius.md,
    minHeight: 48,
    text: { fontSize: 19, lineHeight: 26, fontWeight: '800' },
    iconSize: 24,
    iconStrokeWidth: 3,
    iconGap: 2,
  },
} as const;

type SizeSpec = (typeof sizeMap)[ButtonSize];

/** Applies Button size-token size/weight to icon elements (or leaves non-icons alone). */
function scaleButtonIcon(node: ReactNode, size: SizeSpec): ReactNode {
  if (!isValidElement(node)) return node;
  return cloneElement(node as ReactElement<IconProps>, {
    size: size.iconSize,
    strokeWidth: size.iconStrokeWidth,
  });
}

const SURFACE_ANDROID_ELEVATION = 2;

function resolveButtonShadow(face: MutationPressableFace, theme: Theme) {
  if (face.surfaceShadow !== undefined) {
    return {
      boxShadow: face.surfaceShadow,
      ...(Platform.OS === 'android'
        ? { elevation: SURFACE_ANDROID_ELEVATION }
        : {}),
    };
  }
  if (!face.withElevation) return {};
  const shadow = theme.elevation(1);
  return {
    ...(shadow.boxShadow ? { boxShadow: shadow.boxShadow } : {}),
    ...(shadow.elevation !== undefined ? { elevation: shadow.elevation } : {}),
  };
}

export function buttonForegroundColor(
  theme: Theme,
  intent: ButtonIntent,
  isDisabled: boolean,
  variant: ButtonVariant = 'solid'
): string {
  return mutationPressableForegroundColor(theme, intent, isDisabled, variant);
}

export function Button(props: ButtonProps) {
  const { size = 'md', flex } = props;
  const theme = useTheme();
  const s = sizeMap[size];
  const { phase, face, nonInteractive, handlePress } =
    resolveMutationPressableRender(theme, props);
  const shadow = resolveButtonShadow(face, theme);
  const hasGradient = face.gradient !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      disabled={nonInteractive}
      sx={{ borderRadius: s.borderRadius, overflow: 'hidden' }}
      style={() => ({
        userSelect: 'none',
        ...(flex !== undefined ? { flex } : {}),
        backgroundColor: hasGradient ? 'transparent' : face.backgroundColor,
        borderColor: face.borderColor,
        borderWidth: face.borderWidth,
        borderRadius: s.borderRadius,
        paddingHorizontal: s.px * 4,
        paddingVertical: s.py * 4,
        minHeight: s.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.iconGap * 4,
        overflow: 'hidden',
        ...shadow,
      })}
    >
      {face.gradient !== undefined ? (
        <ButtonSurfaceFill
          top={face.gradient.top}
          bottom={face.gradient.bottom}
          borderRadius={s.borderRadius}
        />
      ) : null}
      <OnColorProvider
        value={{
          fg: face.foregroundColor,
          fgMuted: face.foregroundColor,
          icon: face.foregroundColor,
        }}
      >
        <ButtonContent
          props={props}
          phase={phase}
          size={s}
          foregroundColor={face.foregroundColor}
        />
      </OnColorProvider>
    </Pressable>
  );
}

function ButtonContent({
  props,
  phase,
  size,
  foregroundColor,
}: {
  props: ButtonProps;
  phase: ButtonFeedback;
  size: SizeSpec;
  foregroundColor: string;
}) {
  if (phase === 'loading') {
    return (
      <ButtonStatusContent
        spinner
        size={size}
        foregroundColor={foregroundColor}
        label={props.loadingLabel}
      />
    );
  }
  if (phase === 'success' || phase === 'error') {
    const label = phase === 'success' ? props.successLabel : props.errorLabel;
    return (
      <ButtonStatusContent
        icon={MUTATION_FEEDBACK_ICONS[phase]}
        size={size}
        foregroundColor={foregroundColor}
        label={label ?? props.title}
      />
    );
  }
  return (
    <ButtonIdleContent
      title={props.title}
      size={size}
      foregroundColor={foregroundColor}
      startIcon={props.startIcon}
      endIcon={props.endIcon}
    />
  );
}

function ButtonLabelText({
  label,
  size,
  foregroundColor,
}: {
  label: ReactNode;
  size: SizeSpec;
  foregroundColor: string;
}) {
  return (
    <Text
      variant="bodyBold"
      style={{
        color: foregroundColor,
        fontSize: size.text.fontSize,
        lineHeight: size.text.lineHeight,
        fontWeight: size.text.fontWeight,
        includeFontPadding: false,
        textAlignVertical: 'center',
        ...(Platform.OS === 'web' ? { letterSpacing: 0.1 } : {}),
      }}
      label={label}
    />
  );
}

function ButtonStatusContent({
  spinner = false,
  icon,
  size,
  foregroundColor,
  label,
}: {
  spinner?: boolean;
  icon?: IconComponent;
  size: SizeSpec;
  foregroundColor: string;
  label: ReactNode;
}) {
  const indicator = spinner ? (
    <Spinner color={foregroundColor} size={size.iconSize} />
  ) : (
    (() => {
      const Icon = icon ?? XIcon;
      return (
        <Icon
          size={size.iconSize}
          strokeWidth={size.iconStrokeWidth}
          color={foregroundColor}
        />
      );
    })()
  );
  if (label === undefined || label === null) return indicator;
  return (
    <>
      {indicator}
      <ButtonLabelText
        label={label}
        size={size}
        foregroundColor={foregroundColor}
      />
    </>
  );
}

function ButtonIdleContent({
  title,
  size,
  foregroundColor,
  startIcon,
  endIcon,
}: {
  title: ReactNode;
  size: SizeSpec;
  foregroundColor: string;
  startIcon: ReactNode;
  endIcon: ReactNode;
}) {
  const iconBoxStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    height: size.iconSize,
  } as const;
  return (
    <>
      {startIcon !== undefined ? (
        <View style={iconBoxStyle}>{scaleButtonIcon(startIcon, size)}</View>
      ) : null}
      <ButtonLabelText
        label={title}
        size={size}
        foregroundColor={foregroundColor}
      />
      {endIcon !== undefined ? (
        <View style={iconBoxStyle}>{scaleButtonIcon(endIcon, size)}</View>
      ) : null}
    </>
  );
}
