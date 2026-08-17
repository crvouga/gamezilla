/**
 * `Badge` -- small status indicator or count label.
 *
 * Notification counts: `intent="brand" tone="solid" ping size="sm"`.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="brand" tone="solid" ping size="sm" />
 * ```
 */

import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { ComponentDataSet } from '../../component-id';
import { bestOnColor, type ColorTokens, useTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { AnimatedBox } from '../animated-box';
import { Box } from '../box';
import { Text } from '../text';

export type BadgeIntent =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export type BadgeTone = 'subtle' | 'solid';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: ReactNode;
  /** Semantic intent. Defaults to `"brand"`. */
  intent?: BadgeIntent;
  /** Visual weight. Defaults to `"subtle"`. */
  tone?: BadgeTone;
  /**
   * Optional raw color override (palette token name or any CSS color).
   * When set, supersedes `intent` and renders solid.
   */
  color?: string;
  /** Size preset. Defaults to `"md"`. */
  size?: 'sm' | 'md';
  /** Soft opacity pulse. Prefer `ping` for notification counts. */
  pulse?: boolean;
  /** Expanding ring ping for notification counts. */
  ping?: boolean;
  dataSet?: ComponentDataSet;
};

type IntentTokens = {
  subtle: { bg: keyof ColorTokens; fg: keyof ColorTokens };
  solid: { bg: keyof ColorTokens; fg: keyof ColorTokens };
};

const INTENT_TO_TOKENS: Record<BadgeIntent, IntentTokens> = {
  neutral: {
    subtle: { bg: 'surfaceMuted', fg: 'textSecondary' },
    solid: { bg: 'text', fg: 'background' },
  },
  brand: {
    subtle: { bg: 'tintSubtle', fg: 'tint' },
    solid: { bg: 'tintActive', fg: 'onPrimary' },
  },
  success: {
    subtle: { bg: 'successSurface', fg: 'success' },
    solid: { bg: 'success', fg: 'onSuccess' },
  },
  warning: {
    subtle: { bg: 'warningSurface', fg: 'warning' },
    solid: { bg: 'warning', fg: 'onWarning' },
  },
  destructive: {
    subtle: { bg: 'destructiveSurface', fg: 'destructive' },
    solid: { bg: 'destructiveActive', fg: 'onDestructive' },
  },
  info: {
    subtle: { bg: 'infoSurface', fg: 'info' },
    solid: { bg: 'info', fg: 'onInfo' },
  },
};

const SM_MIN_SIZE = 18;
const PULSE_MIN_OPACITY = 0.55;
const PULSE_DURATION = duration.slower * 2;
const PING_DURATION = duration.slower * 2;
const PING_SCALE_TO = 1.85;

function usePulseOpacity(enabled: boolean): Animated.Value {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN_OPACITY,
          duration: PULSE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [enabled, opacity]);
  return opacity;
}

function usePingAnim(enabled: boolean): {
  scale: Animated.Value;
  opacity: Animated.Value;
} {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (!enabled) {
      scale.setValue(1);
      opacity.setValue(0);
      return undefined;
    }
    scale.setValue(1);
    opacity.setValue(0.7);
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, {
          toValue: PING_SCALE_TO,
          duration: PING_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: PING_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
      opacity.setValue(0);
    };
  }, [enabled, opacity, scale]);
  return { scale, opacity };
}

function resolveBadgeColors(args: {
  intent: BadgeIntent;
  tone: BadgeTone;
  color: string | undefined;
  themeColors: ColorTokens & Record<string, string>;
}): { bg: string; fg: string } {
  const tokens = INTENT_TO_TOKENS[args.intent][args.tone];
  if (args.color !== undefined) {
    const bg = args.themeColors[args.color] ?? args.color;
    return { bg, fg: bestOnColor(bg).fg };
  }
  return {
    bg: args.themeColors[tokens.bg],
    fg: args.themeColors[tokens.fg],
  };
}

function BadgeLabel({
  label,
  fg,
  isSmall,
}: {
  label: ReactNode;
  fg: string;
  isSmall: boolean;
}): ReactNode {
  const fontSize = isSmall ? 11 : 12;
  return (
    <Text
      sx={{
        color: fg,
        fontSize,
        lineHeight: fontSize + 2,
        fontWeight: '700',
      }}
      label={label}
    />
  );
}

function BadgePlate({
  bg,
  isSmall,
  children,
  opacity,
  dataSet,
}: {
  bg: string;
  isSmall: boolean;
  children: ReactNode;
  opacity?: Animated.Value;
  dataSet?: ComponentDataSet;
}): ReactNode {
  const plateSx = {
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
    borderRadius: 'full' as const,
    paddingHorizontal: isSmall ? 6 : 8,
    paddingVertical: isSmall ? 2 : 3,
    ...(isSmall
      ? { minWidth: SM_MIN_SIZE, minHeight: SM_MIN_SIZE }
      : undefined),
  };
  if (opacity !== undefined) {
    return (
      <AnimatedBox
        dataSet={{ component: 'Badge', ...dataSet }}
        sx={{ ...plateSx, opacity }}
      >
        {children}
      </AnimatedBox>
    );
  }
  return (
    <Box dataSet={{ component: 'Badge', ...dataSet }} sx={plateSx}>
      {children}
    </Box>
  );
}

function BadgeWithPing({
  bg,
  fg,
  label,
  isSmall,
  dataSet,
  scale,
  opacity,
}: {
  bg: string;
  fg: string;
  label: ReactNode;
  isSmall: boolean;
  dataSet?: ComponentDataSet;
  scale: Animated.Value;
  opacity: Animated.Value;
}): ReactNode {
  const plateSx = {
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
    borderRadius: 'full' as const,
    paddingHorizontal: isSmall ? 6 : 8,
    paddingVertical: isSmall ? 2 : 3,
    ...(isSmall
      ? { minWidth: SM_MIN_SIZE, minHeight: SM_MIN_SIZE }
      : undefined),
  };
  return (
    <Box
      dataSet={{ component: 'Badge', ...dataSet }}
      sx={{ position: 'relative', alignSelf: 'flex-start' }}
    >
      <AnimatedBox
        sx={{
          ...plateSx,
          position: 'absolute',
          inset: 0,
          opacity,
          transform: [{ scale }],
        }}
      />
      <Box sx={plateSx}>
        <BadgeLabel label={label} fg={fg} isSmall={isSmall} />
      </Box>
    </Box>
  );
}

export function Badge({
  label,
  intent = 'brand',
  tone = 'subtle',
  color,
  size = 'md',
  pulse = false,
  ping = false,
  dataSet,
}: BadgeProps) {
  const theme = useTheme();
  const { bg, fg } = resolveBadgeColors({
    intent,
    tone,
    color,
    themeColors: theme.colors,
  });
  const isSmall = size === 'sm';
  const pulseOpacity = usePulseOpacity(pulse && !ping);
  const pingAnim = usePingAnim(ping);
  const labelNode = <BadgeLabel label={label} fg={fg} isSmall={isSmall} />;

  if (ping) {
    return (
      <BadgeWithPing
        bg={bg}
        fg={fg}
        label={label}
        isSmall={isSmall}
        {...(dataSet !== undefined ? { dataSet } : {})}
        scale={pingAnim.scale}
        opacity={pingAnim.opacity}
      />
    );
  }

  return (
    <BadgePlate
      bg={bg}
      isSmall={isSmall}
      {...(pulse ? { opacity: pulseOpacity } : {})}
      {...(dataSet !== undefined ? { dataSet } : {})}
    >
      {labelNode}
    </BadgePlate>
  );
}
