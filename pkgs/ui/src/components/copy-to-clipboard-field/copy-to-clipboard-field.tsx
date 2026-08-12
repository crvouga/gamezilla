/**
 * Read-only “text field” that copies `value` to the clipboard when pressed.
 * Copy / check icons swap with a short scale animation on success; optional
 * helper line shows “Copied” feedback then resets.
 */

import { useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import type { LocalizedString } from '@pkgs/i18n';
import * as Clipboard from 'expo-clipboard';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated } from 'react-native';

import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { AnimatedBox } from '../animated-box';
import { Box } from '../box';
import { CircleCheckIcon, CopyIcon } from '../icons';
import { Pressable } from '../pressable';
import { Text } from '../text';

const DEFAULT_COPIED_RESET_MS = 2000;
const ICON_SIZE = 22;

export type CopyToClipboardFieldProps = {
  /** String written to the clipboard on press. */
  value: string;
  /** Optional label above the field (same role as TextInput `label`). */
  label?: ReactNode;
  /** Shown below the field when idle (hidden while `copiedLabel` is showing). */
  helperText?: LocalizedString;
  /** Shown briefly after a successful copy. */
  copiedLabel?: LocalizedString;
  /** How long to show `copiedLabel` before returning to helper/idle. */
  copiedResetMs?: number;
  /** When true, the value is user-selectable as well as copy-on-press. */
  selectable?: boolean;
  sx?: SxInput;
  testID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function runCopyAnimation(
  iconScale: Animated.Value,
  rowScale: Animated.Value
): void {
  iconScale.setValue(1);
  rowScale.setValue(1);
  Animated.parallel([
    Animated.sequence([
      Animated.timing(iconScale, {
        toValue: 1.22,
        duration: 90,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 280,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]),
    Animated.sequence([
      Animated.timing(rowScale, {
        toValue: 1.015,
        duration: 90,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(rowScale, {
        toValue: 1,
        friction: 6,
        tension: 320,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]),
  ]).start();
}

function useFeedbackOpacity(copied: boolean): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: copied ? 1 : 0,
      duration: copied ? 160 : 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [copied, opacity]);
  return opacity;
}

function useCopiedReset(
  copied: boolean,
  setCopied: (b: boolean) => void,
  copiedResetMs: number
): void {
  const timers = useTimers();
  useEffect(() => {
    if (!copied) return;
    const id = timers.setTimeout(() => setCopied(false), copiedResetMs);
    return () => timers.clearTimeout(id);
  }, [copied, copiedResetMs, setCopied, timers]);
}

export function CopyToClipboardField({
  value,
  label,
  helperText,
  copiedLabel,
  copiedResetMs = DEFAULT_COPIED_RESET_MS,
  selectable = true,
  sx: sxProp,
  testID,
  dataSet,
}: CopyToClipboardFieldProps) {
  const { t } = useLingui();
  const copiedLabelResolved = copiedLabel ?? t`Copied to clipboard`;
  const [copied, setCopied] = useState(false);
  const iconScale = useRef(new Animated.Value(1)).current;
  const rowScale = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useFeedbackOpacity(copied);
  useCopiedReset(copied, setCopied, copiedResetMs);

  const onPress = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(value);
    } catch {
      return;
    }
    setCopied(true);
    runCopyAnimation(iconScale, rowScale);
  }, [iconScale, rowScale, value]);

  return (
    <Box
      sx={[{ gap: 1 }, sxProp]}
      testID={testID}
      dataSet={{ component: 'CopyToClipboardField', ...dataSet }}
    >
      {label !== undefined ? <Text variant="label" label={label} /> : null}
      <CopyRow
        copied={copied}
        copiedLabel={copiedLabelResolved}
        onPress={() => {
          void onPress();
        }}
        rowScale={rowScale}
        iconScale={iconScale}
        value={value}
        selectable={selectable}
      />
      <FeedbackLine
        copied={copied}
        copiedLabel={copiedLabelResolved}
        helperText={helperText}
        opacity={feedbackOpacity}
      />
    </Box>
  );
}

function CopyRow({
  copied,
  copiedLabel,
  onPress,
  rowScale,
  iconScale,
  value,
  selectable,
}: {
  copied: boolean;
  copiedLabel: LocalizedString;
  onPress: () => void;
  rowScale: Animated.Value;
  iconScale: Animated.Value;
  value: string;
  selectable: boolean;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const iconColor = copied ? theme.colors.tint : theme.colors.icon;
  return (
    <AnimatedBox sx={{ transform: [{ scale: rowScale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? copiedLabel : t`Copy to clipboard`}
        onPress={onPress}
        feedback="none"
        sx={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          borderWidth: 1,
          borderColor: 'outline',
          borderRadius: borderRadius.md,
          backgroundColor: 'surfaceMuted',
          paddingVertical: 10,
          paddingHorizontal: 12,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" selectable={selectable} label={value} />
        </Box>
        <AnimatedBox
          sx={{
            transform: [{ scale: iconScale }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {(() => {
            const Icon = copied ? CircleCheckIcon : CopyIcon;
            return <Icon size={ICON_SIZE} color={iconColor} />;
          })()}
        </AnimatedBox>
      </Pressable>
    </AnimatedBox>
  );
}

function FeedbackLine({
  copied,
  copiedLabel,
  helperText,
  opacity,
}: {
  copied: boolean;
  copiedLabel: LocalizedString;
  helperText: LocalizedString | undefined;
  opacity: Animated.Value;
}) {
  return copied ? (
    <AnimatedBox sx={{ opacity }}>
      <Text variant="caption" label={copiedLabel} />
    </AnimatedBox>
  ) : helperText !== undefined ? (
    <Text variant="caption" label={helperText} />
  ) : (
    <Text variant="caption" label="" />
  );
}
