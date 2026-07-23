/**
 * Rectangular ActionBar control: icon/avatar + under-caption as one press target.
 *
 * The media slot is always `buttonSize` tall so icon and avatar items share the
 * same footprint and under-captions line up in a row.
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import { borderRadius } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

export function ActionBarInlineCaption(p: { caption: ReactNode }): ReactNode {
  return (
    <Text
      variant="caption"
      numberOfLines={1}
      ellipsizeMode="tail"
      sx={{ color: 'textSecondary', textAlign: 'center' }}
      style={{ width: '100%' }}
      label={p.caption}
    />
  );
}

function resolveA11yLabel(
  label: ReactNode,
  override: LocalizedString | undefined
): LocalizedString | undefined {
  if (override !== undefined) return override;
  if (typeof label === 'string') return label as LocalizedString;
  return undefined;
}

export type ActionBarLabeledControlProps = {
  /** Visible under-icon caption. */
  caption: ReactNode;
  /** Full label for screen readers (defaults to caption when string). */
  label: ReactNode;
  accessibilityLabel?: LocalizedString;
  /** Fixed media-slot height; matches ActionBar `buttonSize`. */
  buttonSize: number;
  slotWidth: number;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
};

export function ActionBarLabeledControl(
  p: ActionBarLabeledControlProps
): ReactNode {
  const a11y = resolveA11yLabel(p.label, p.accessibilityLabel);
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled === true}
      accessibilityRole="button"
      {...(a11y !== undefined ? { accessibilityLabel: a11y } : {})}
      {...(p.testID !== undefined ? { testID: p.testID } : {})}
      sx={{
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
      }}
      style={{
        width: p.slotWidth,
        maxWidth: p.slotWidth,
        opacity: p.disabled === true ? 0.5 : 1,
        paddingVertical: 2,
        gap: 2,
      }}
    >
      <Box
        style={{
          height: p.buttonSize,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {p.children}
      </Box>
      <ActionBarInlineCaption caption={p.caption} />
    </Pressable>
  );
}
