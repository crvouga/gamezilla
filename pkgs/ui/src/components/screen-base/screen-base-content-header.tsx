import type { ReactNode } from 'react';
import { Platform, type TextStyle } from 'react-native';

import { fontSize as fontSizeScale } from '../../theme/scale';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import type { MutationButtonProps } from '../button/use-mutation-button';
import type { IconComponent } from '../icons';
import { Text } from '../text';

const CONTENT_HEADER_TITLE_FONT_SIZE = fontSizeScale['2xl'];
const CONTENT_HEADER_BUTTON_ICON_SIZE = 20;

function contentHeaderTitleLineHeight(size: number): number {
  return Math.round(size * 1.2);
}

function contentHeaderTitleFontFamily(
  theme: ReturnType<typeof useTheme>
): string {
  if (Platform.OS === 'android') {
    return theme.fonts.sansSemibold ?? 'sans-serif-medium';
  }
  return theme.fonts.sans;
}

function contentHeaderTitleStyle(
  theme: ReturnType<typeof useTheme>
): TextStyle {
  const lineHeight = contentHeaderTitleLineHeight(
    CONTENT_HEADER_TITLE_FONT_SIZE
  );
  return {
    flexShrink: 1,
    fontSize: CONTENT_HEADER_TITLE_FONT_SIZE,
    lineHeight,
    fontWeight: '900',
    fontFamily: contentHeaderTitleFontFamily(theme),
    color: theme.colors.text,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    ...(Platform.OS === 'web'
      ? {
          letterSpacing: -0.4,
          fontSynthesis: 'weight',
          WebkitFontSmoothing: 'antialiased',
        }
      : {}),
  };
}

export function ScreenBaseContentHeader({
  title,
  buttonProps,
  icon,
}: {
  title: ReactNode;
  buttonProps: MutationButtonProps;
  icon?: IconComponent | undefined;
}): ReactNode {
  const theme = useTheme();
  return (
    <Box
      style={{ width: '100%' }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          pr: 4,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text
          accessibilityRole="header"
          aria-level={1}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={contentHeaderTitleStyle(theme)}
          label={title}
        />
      </Box>
      <Box sx={{ flexDirection: 'row', alignItems: 'center' }}>
        <Button
          {...buttonProps}
          intent="primary"
          size="md"
          startIcon={
            icon !== undefined ? (
              (() => {
                const Icon = icon;
                return (
                  <Icon
                    size={CONTENT_HEADER_BUTTON_ICON_SIZE}
                    color={theme.colors.onPrimary}
                  />
                );
              })()
            ) : undefined
          }
        />
      </Box>
    </Box>
  );
}
