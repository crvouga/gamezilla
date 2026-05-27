/**
 * `SchemePreview` -- side-by-side preview of children in both color schemes.
 *
 * Wraps `children` in two parallel {@link ThemeProvider}s pinned to
 * `'light'` and `'dark'` so Explorer pages can show how a primitive looks
 * in both modes without the user toggling the global theme.
 *
 * Uses `ThemeProvider` directly (not `AppThemeRoot`) so we don't double up
 * on the global side-effects (status bar, navigation theme, scrollbar).
 *
 * Stacks vertically below the `stackBelow` breakpoint to keep narrow
 * (mobile) previews readable.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemeProvider, useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { Text } from '../text';

export type SchemePreviewProps = {
  children: ReactNode;
  /** Layout breakpoint below which the panes stack vertically. Defaults to 720. */
  stackBelow?: number;
};

export function SchemePreview({
  children,
  stackBelow = 720,
}: SchemePreviewProps): ReactNode {
  return (
    <SchemePreviewLayout stackBelow={stackBelow}>
      <SchemePane label="Light" scheme="light">
        {children}
      </SchemePane>
      <SchemePane label="Dark" scheme="dark">
        {children}
      </SchemePane>
    </SchemePreviewLayout>
  );
}

function SchemePreviewLayout({
  children,
  stackBelow,
}: {
  children: ReactNode;
  stackBelow: number;
}): ReactNode {
  const theme = useTheme();
  const isNarrow = theme.layout.width < stackBelow;
  return (
    <View
      style={{
        flexDirection: isNarrow ? 'column' : 'row',
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}

function SchemePane({
  label,
  scheme,
  children,
}: {
  label: string;
  scheme: 'light' | 'dark';
  children: ReactNode;
}): ReactNode {
  return (
    <ThemeProvider colorScheme={scheme}>
      <SchemePaneBody label={label}>{children}</SchemePaneBody>
    </ThemeProvider>
  );
}

function SchemePaneBody({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flex: 1,
        p: 4,
        gap: 3,
        background: 'background',
      }}
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: borderRadius.lg,
      }}
    >
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={label.toUpperCase()}
      />
      {children}
    </Box>
  );
}
