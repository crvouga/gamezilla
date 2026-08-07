import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated } from 'react-native';

import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { ColorTokens } from '../../theme';
import { useTheme } from '../../theme';
import { IconButton } from '../icon-button';
import { CircleCheckIcon, type IconComponent } from '../icons';
import { ActionBarLabeledControl } from './action-bar-labeled-control';
import type {
  ActionBarIconItem,
  ActionBarPressFeedback,
} from './partition-action-bar-items';

const DEFAULT_FEEDBACK_RESET_MS = 2000;

function runIconScaleAnimation(scale: Animated.Value): void {
  scale.setValue(1);
  Animated.sequence([
    Animated.timing(scale, {
      toValue: 1.22,
      duration: 90,
      useNativeDriver: USE_NATIVE_DRIVER,
    }),
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 280,
      useNativeDriver: USE_NATIVE_DRIVER,
    }),
  ]).start();
}

function usePressFeedbackReset(
  active: boolean,
  resetMs: number,
  onReset: () => void
): void {
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(onReset, resetMs);
    return () => clearTimeout(id);
  }, [active, resetMs, onReset]);
}

function resolveIconPresentation(args: {
  item: ActionBarIconItem;
  success: boolean;
  colors: ColorTokens;
}): {
  tooltipLabel: ReactNode;
  Icon: IconComponent;
  iconColor: string;
} {
  const feedback = args.item.pressFeedback;
  const inSuccess = args.success && feedback !== undefined;
  return {
    tooltipLabel: inSuccess ? feedback!.successLabel : args.item.label,
    Icon: inSuccess
      ? (feedback!.successIcon ?? CircleCheckIcon)
      : args.item.icon,
    iconColor: inSuccess ? args.colors.success : args.colors.icon,
  };
}

function ActionBarIconFace(p: {
  item: ActionBarIconItem;
  buttonSize: number;
  showInlineLabel: boolean;
  slotWidth: number;
}): ReactNode {
  const theme = useTheme();
  const [success, setSuccess] = useState(false);
  const iconScale = useRef(new Animated.Value(1)).current;
  const feedback = p.item.pressFeedback;
  const resetMs = feedback?.resetMs ?? DEFAULT_FEEDBACK_RESET_MS;
  const resetSuccess = useCallback(() => setSuccess(false), []);
  usePressFeedbackReset(success, resetMs, resetSuccess);

  const onPress = useCallback(() => {
    if (p.item.disabled === true || p.item.loading === true) return;
    p.item.onPress();
    if (feedback === undefined) return;
    setSuccess(true);
    runIconScaleAnimation(iconScale);
  }, [feedback, iconScale, p.item]);

  const { tooltipLabel, Icon, iconColor } = resolveIconPresentation({
    item: p.item,
    success,
    colors: theme.colors,
  });
  const caption = p.item.shortLabel ?? p.item.label;
  const disabled = p.item.disabled === true || p.item.loading === true;
  const iconNode = (
    <Animated.View style={{ transform: [{ scale: iconScale }] }}>
      <Icon size={Math.round(p.buttonSize * 0.55)} color={iconColor} />
    </Animated.View>
  );

  if (p.showInlineLabel) {
    return (
      <ActionBarLabeledControl
        caption={caption}
        label={p.item.label}
        buttonSize={p.buttonSize}
        slotWidth={p.slotWidth}
        disabled={disabled}
        onPress={onPress}
      >
        {iconNode}
      </ActionBarLabeledControl>
    );
  }

  return (
    <IconButton
      size={p.buttonSize}
      label={tooltipLabel}
      onPress={onPress}
      tooltip="hover"
      flashTooltipOnPress={feedback !== undefined}
      disabled={disabled}
    >
      {iconNode}
    </IconButton>
  );
}

export function ActionBarIconButton(p: {
  item: ActionBarIconItem;
  buttonSize: number;
  showInlineLabel: boolean;
  slotWidth: number;
}): ReactNode {
  return <ActionBarIconFace {...p} />;
}

export type { ActionBarPressFeedback };
