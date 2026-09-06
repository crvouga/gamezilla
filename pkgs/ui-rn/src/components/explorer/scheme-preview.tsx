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
 * Panes stack vertically for mobile-first readability.
 */

import type { ReactNode } from 'react';

import { ThemeProvider } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { Text } from '../text';

export type SchemePreviewProps = {
  children: ReactNode;
};

export function SchemePreview({ children }: SchemePreviewProps): ReactNode {
  return (
    <Box sx={{ flexDirection: 'column', gap: 4 }}>
      <SchemePane label="Light" scheme="light">
        {children}
      </SchemePane>
      <SchemePane label="Dark" scheme="dark">
        {children}
      </SchemePane>
    </Box>
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
  return (
    <Box
      sx={{
        flex: 1,
        p: 4,
        gap: 3,
        background: 'background',
        borderWidth: 1,
        borderColor: 'border',
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
