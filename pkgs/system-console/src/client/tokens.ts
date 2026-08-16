import type { BadgeIntent, SxProps } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui';

/** Full-height shell: fill parent, product background. */
export const appShellSx: SxProps = {
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  background: 'background',
};

/** Compact top bar for report screens. */
export const appHeaderSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2.5,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surface',
  flexGrow: 0,
  flexShrink: 0,
};

export const appHeaderTrailingSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2.5,
};

/** Scroll frame for list/table screens. */
export const appBodyFrameSx: SxProps = {
  flex: 1,
  minHeight: 0,
  background: 'background',
};

/** Responsive body padding — call from components under ThemeProvider. */
export function useAppBodyContentSx(): SxProps {
  const { breakpoint } = useTheme();
  const mobile = breakpoint === 'mobile';
  return {
    paddingHorizontal: mobile ? 12 : 28,
    paddingTop: mobile ? 16 : 24,
    paddingBottom: 40,
    gap: mobile ? 3 : 4,
  };
}

export const emptySx: SxProps = {
  color: 'textSecondary',
  padding: 6,
};

export const metaSx: SxProps = {
  color: 'textSecondary',
  fontSize: 12,
};

export const testIdSx: SxProps = {
  fontWeight: '600',
  color: 'tint',
};

export const thSx: SxProps = {
  color: 'textSecondary',
  fontWeight: '500',
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontSize: 10,
};

export const rowSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
  paddingHorizontal: 12,
  gap: 3,
  borderBottomWidth: 1,
  borderColor: 'border',
};

export const cellTextSx: SxProps = {
  color: 'text',
  fontSize: 12,
};

/** Map report / session status strings to Badge intent. */
export function statusBadgeIntent(status: string): BadgeIntent {
  if (status === 'passed' || status === 'ready') return 'success';
  if (status === 'failed' || status === 'error') return 'destructive';
  return 'neutral';
}

/** Detail/preview panes. */
export const paneSx: SxProps = {
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  background: 'background',
};
