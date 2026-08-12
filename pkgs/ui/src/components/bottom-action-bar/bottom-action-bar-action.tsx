/**
 * Tab-style bottom-bar control: icon above short label, no filled chip.
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { borderRadius, useTheme } from '../../theme';
import { Pressable } from '../pressable';
import { Text } from '../text';
import type { BottomActionBarActionItem } from './bottom-action-bar-types';

const ICON_SIZE = 24;
const ICON_STROKE_WIDTH = 2.75;

function resolveA11yLabel(
  label: ReactNode,
  override: LocalizedString | undefined
): LocalizedString | undefined {
  if (override !== undefined) return override;
  if (typeof label === 'string') return label as LocalizedString;
  return undefined;
}

export function BottomActionBarAction(
  item: BottomActionBarActionItem
): ReactNode {
  const theme = useTheme();
  const disabled = item.disabled === true;
  const selected = item.selected === true;
  const colorToken = selected ? 'tint' : disabled ? 'textSecondary' : 'icon';
  const captionToken = selected ? 'tint' : 'textSecondary';
  const color = theme.colors[colorToken];
  const Icon = item.icon;
  const a11y = resolveA11yLabel(item.label, item.accessibilityLabel);

  return (
    <Pressable
      onPress={item.onPress}
      disabled={disabled}
      accessibilityRole="button"
      {...(a11y !== undefined ? { accessibilityLabel: a11y } : {})}
      {...(item.testID !== undefined ? { testID: item.testID } : {})}
      sx={{
        flex: 1,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
        opacity: disabled ? 0.5 : 1,
        paddingVertical: 4,
        gap: 0.5,
      }}
    >
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} color={color} />
      <Text
        variant="caption"
        numberOfLines={1}
        ellipsizeMode="tail"
        sx={{
          color: captionToken,
          textAlign: 'center',
          fontWeight: '700',
          width: '100%',
          fontSize: 13,
          lineHeight: 18,
        }}
        label={item.label}
      />
    </Pressable>
  );
}
