/**
 * Read-only “text field” that copies `value` to the clipboard when pressed.
 * Copy / check icons swap with a short scale animation on success; optional
 * helper line shows “Copied” feedback then resets.
 */

import type { LocalizedString } from '@gamezilla/i18n';
import { useLingui } from '@lingui/react/macro';
import * as Clipboard from 'expo-clipboard';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, View, type ViewStyle } from 'react-native';

import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { IconSymbol } from '../symbol-icon';
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
  sx?: SxProps;
  testID?: string;
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
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
    ]),
    Animated.sequence([
      Animated.timing(rowScale, {
        toValue: 1.015,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(rowScale, {
        toValue: 1,
        friction: 6,
        tension: 320,
        useNativeDriver: true,
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
      useNativeDriver: true,
    }).start();
  }, [copied, opacity]);
  return opacity;
}

function useCopiedReset(
  copied: boolean,
  setCopied: (b: boolean) => void,
  copiedResetMs: number
): void {
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), copiedResetMs);
    return () => clearTimeout(id);
  }, [copied, copiedResetMs, setCopied]);
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
}: CopyToClipboardFieldProps) {
  const { t } = useLingui();
  const copiedLabelResolved = copiedLabel ?? t`Copied to clipboard`;
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
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
    <View style={[{ gap: 4 }, sxStyle]} testID={testID}>
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
    </View>
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
  const fieldStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
  };
  const iconColor = copied ? theme.colors.tint : theme.colors.icon;
  return (
    <Animated.View style={{ transform: [{ scale: rowScale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? copiedLabel : t`Copy to clipboard`}
        onPress={onPress}
        style={({ pressed }) => [fieldStyle, pressed && { opacity: 0.92 }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" selectable={selectable} label={value} />
        </View>
        <Animated.View
          style={{
            transform: [{ scale: iconScale }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSymbol
            name={copied ? 'check.circle.fill' : 'copy'}
            size={ICON_SIZE}
            color={iconColor}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
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
  return (
    <View style={{ minHeight: 18 }}>
      {copied ? (
        <Animated.View style={{ opacity }}>
          <Text variant="caption" label={copiedLabel} />
        </Animated.View>
      ) : helperText !== undefined ? (
        <Text variant="caption" label={helperText} />
      ) : null}
    </View>
  );
}
