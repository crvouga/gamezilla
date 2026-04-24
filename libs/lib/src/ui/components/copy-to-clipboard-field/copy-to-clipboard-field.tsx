/**
 * Read-only “text field” that copies `value` to the clipboard when pressed.
 * Copy / check icons swap with a short scale animation on success; optional
 * helper line shows “Copied” feedback then resets.
 */

import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  label?: string;
  /** Shown below the field when idle (hidden while `copiedLabel` is showing). */
  helperText?: string;
  /** Shown briefly after a successful copy. */
  copiedLabel?: string;
  /** How long to show `copiedLabel` before returning to helper/idle. */
  copiedResetMs?: number;
  /** When true, the value is user-selectable as well as copy-on-press. */
  selectable?: boolean;
  sx?: SxProps;
  testID?: string;
};

export function CopyToClipboardField({
  value,
  label,
  helperText,
  copiedLabel = 'Copied to clipboard',
  copiedResetMs = DEFAULT_COPIED_RESET_MS,
  selectable = true,
  sx: sxProp,
  testID,
}: CopyToClipboardFieldProps) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const [copied, setCopied] = useState(false);
  const iconScale = useRef(new Animated.Value(1)).current;
  const rowScale = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  const runSuccessAnimations = useCallback(() => {
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
  }, [iconScale, rowScale]);

  const onPress = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(value);
    } catch {
      return;
    }
    setCopied(true);
    runSuccessAnimations();
  }, [runSuccessAnimations, value]);

  useEffect(() => {
    if (copied) {
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [copied, feedbackOpacity]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), copiedResetMs);
    return () => clearTimeout(id);
  }, [copied, copiedResetMs]);

  const borderColor = theme.colors.border;
  const fieldStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
  };

  const iconColor = copied ? theme.colors.tint : theme.colors.icon;

  return (
    <View style={[{ gap: 4 }, sxStyle]} testID={testID}>
      {label ? <Text variant="label" label={label} /> : null}
      <Animated.View style={{ transform: [{ scale: rowScale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            copied ? copiedLabel : `${label ?? 'Value'}: copy to clipboard`
          }
          onPress={onPress}
          style={({ pressed }) => [
            fieldStyle,
            pressed && { opacity: 0.92 },
          ]}
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
            {copied ? (
              <IconSymbol
                name="check.circle.fill"
                size={ICON_SIZE}
                color={iconColor}
              />
            ) : (
              <IconSymbol name="copy" size={ICON_SIZE} color={iconColor} />
            )}
          </Animated.View>
        </Pressable>
      </Animated.View>
      <View style={{ minHeight: 18 }}>
        {copied ? (
          <Animated.View style={{ opacity: feedbackOpacity }}>
            <Text variant="caption" label={copiedLabel} />
          </Animated.View>
        ) : helperText ? (
          <Text variant="caption" label={helperText} />
        ) : null}
      </View>
    </View>
  );
}
