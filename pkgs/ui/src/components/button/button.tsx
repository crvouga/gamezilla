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
import { Platform } from 'react-native';
import type { ComponentDataSet } from '../../component-id';
import {
  OnColorProvider,
  type SxProps,
  type Theme,
  useTheme,
} from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { type IconComponent, type IconProps, XIcon } from '../icons';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { Text } from '../text';
import { ButtonSurfaceFill } from './button-surface-fill';
import {
  type ButtonFeedback,
  type ButtonIntent,
  type ButtonVariant,
  MUTATION_FEEDBACK_ICONS,
  type MutationPressableFace,
  mutationPressableForegroundColor,
  resolveMutationPressableRender,
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
  testID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export type ButtonSize = 'sm' | 'md' | 'lg';

const sizeMap = {
  sm: {
    py: 1.5,
    px: 3,
    borderRadius: borderRadius.md,
    minHeight: 32,
    text: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
    iconSize: 18,
    iconStrokeWidth: 2.75,
    iconGap: 1.5,
  },
  md: {
    py: 2.5,
    px: 4,
    borderRadius: borderRadius.md,
    minHeight: 40,
    text: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
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

function resolveButtonShadow(
  face: MutationPressableFace,
  theme: Theme
): Pick<SxProps, 'boxShadow'> {
  if (face.surfaceShadow !== undefined) {
    return { boxShadow: face.surfaceShadow };
  }
  if (!face.withElevation) return {};
  const shadow = theme.elevation(1);
  return shadow.boxShadow ? { boxShadow: shadow.boxShadow } : {};
}

function buttonSx(args: {
  flex: number | undefined;
  s: SizeSpec;
  face: MutationPressableFace;
  hasGradient: boolean;
  shadow: Pick<SxProps, 'boxShadow'>;
}): SxProps {
  const { flex, s, face, hasGradient, shadow } = args;
  return {
    userSelect: 'none',
    ...(flex !== undefined ? { flex } : {}),
    backgroundColor: hasGradient ? 'transparent' : face.backgroundColor,
    borderColor: face.borderColor,
    borderWidth: face.borderWidth,
    borderRadius: s.borderRadius,
    px: s.px,
    py: s.py,
    minHeight: s.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.iconGap,
    overflow: 'hidden',
    ...shadow,
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
  const { size = 'md', flex, dataSet, testID } = props;
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
      sx={buttonSx({ flex, s, face, hasGradient, shadow })}
      dataSet={{ component: 'Button', ...dataSet }}
      {...(testID !== undefined ? { testID } : {})}
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
        {/*
          Above absolute GradientBox: CSS paints positioned abs above in-flow
          text unless content establishes a higher stacking level. Row layout
          lives here (not only on Pressable) so icon + label share one line.
        */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s.iconGap,
          }}
        >
          <ButtonContent
            props={props}
            phase={phase}
            size={s}
            foregroundColor={face.foregroundColor}
          />
        </Box>
      </OnColorProvider>
    </Pressable>
  );
}

/** Blank strings do not reserve width; treat them as missing labels. */
function coalesceButtonLabel(
  label: ReactNode | undefined,
  fallback: ReactNode
): ReactNode {
  if (label === undefined || label === null) return fallback;
  if (typeof label === 'string' && label.trim() === '') return fallback;
  return label;
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
  const idle = (
    <ButtonIdleContent
      title={props.title}
      size={size}
      foregroundColor={foregroundColor}
      startIcon={props.startIcon}
      endIcon={props.endIcon}
    />
  );
  if (phase === 'idle') return idle;
  return (
    <ButtonFeedbackWidthLock size={size} idle={idle}>
      <ButtonFeedbackFace
        props={props}
        phase={phase}
        size={size}
        foregroundColor={foregroundColor}
      />
    </ButtonFeedbackWidthLock>
  );
}

/**
 * Keep the idle label's width while feedback content (spinner / check) is
 * shorter — otherwise success collapses to an icon-only square.
 */
function ButtonFeedbackWidthLock({
  size,
  idle,
  children,
}: {
  size: SizeSpec;
  idle: ReactNode;
  children: ReactNode;
}) {
  const rowSx = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: size.iconGap,
  };
  return (
    <Box sx={{ position: 'relative', ...rowSx }}>
      <Box
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        sx={{ ...rowSx, opacity: 0 }}
      >
        {idle}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          ...rowSx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function ButtonFeedbackFace({
  props,
  phase,
  size,
  foregroundColor,
}: {
  props: ButtonProps;
  phase: Exclude<ButtonFeedback, 'idle'>;
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
  const label = coalesceButtonLabel(
    phase === 'success' ? props.successLabel : props.errorLabel,
    props.title
  );
  return (
    <ButtonStatusContent
      icon={MUTATION_FEEDBACK_ICONS[phase]}
      size={size}
      foregroundColor={foregroundColor}
      label={label}
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
      sx={{
        color: foregroundColor,
        fontSize: size.text.fontSize,
        lineHeight: size.text.lineHeight,
        fontWeight: size.text.fontWeight,
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
  const iconBoxSx = {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: size.iconSize,
  };
  return (
    <>
      {startIcon !== undefined ? (
        <Box sx={iconBoxSx}>{scaleButtonIcon(startIcon, size)}</Box>
      ) : null}
      <ButtonLabelText
        label={title}
        size={size}
        foregroundColor={foregroundColor}
      />
      {endIcon !== undefined ? (
        <Box sx={iconBoxSx}>{scaleButtonIcon(endIcon, size)}</Box>
      ) : null}
    </>
  );
}
