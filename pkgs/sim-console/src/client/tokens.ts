import type { BadgeIntent } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

/** Full-height shell: fill parent, product background. */
export const appShellSx: JSX.CSSProperties = {
  flex: 1,
  'flex-direction': 'column',
  'min-height': 0,
  background: 'var(--ui-color-background)',
};

/** Compact top bar for report screens. */
export const appHeaderSx: JSX.CSSProperties = {
  'flex-direction': 'row',
  'align-items': 'center',
  gap: '10px',
  'padding-left': '12px',
  'padding-right': '12px',
  'padding-top': '6px',
  'padding-bottom': '6px',
  'border-bottom-width': '1px',
  'border-bottom-style': 'solid',
  'border-bottom-color': 'var(--ui-color-border)',
  background: 'var(--ui-color-surface)',
  'flex-grow': 0,
  'flex-shrink': 0,
};

export const appHeaderMiddleSx: JSX.CSSProperties = {
  flex: 1,
  'min-width': 0,
  'flex-direction': 'row',
  'align-items': 'center',
  gap: '8px',
};

export const appHeaderTrailingSx: JSX.CSSProperties = {
  'flex-direction': 'row',
  'align-items': 'center',
  gap: '4px',
};

/** Scroll frame for list/table screens. */
export const appBodyFrameSx: JSX.CSSProperties = {
  flex: 1,
  'min-height': 0,
  background: 'var(--ui-color-background)',
};

/** Responsive body padding — call from components under ThemeProvider. */
export function useAppBodyContentSx(): JSX.CSSProperties {
  const theme = useTheme();
  const mobile = () => theme.breakpoint() === 'mobile';
  return {
    get 'padding-left'() {
      return mobile() ? '12px' : '28px';
    },
    get 'padding-right'() {
      return mobile() ? '12px' : '28px';
    },
    get 'padding-top'() {
      return mobile() ? '16px' : '24px';
    },
    'padding-bottom': '40px',
    get gap() {
      return mobile() ? '12px' : '16px';
    },
  };
}

export const emptySx: JSX.CSSProperties = {
  color: 'var(--ui-color-text-secondary)',
  padding: '24px',
};

export const metaSx: JSX.CSSProperties = {
  color: 'var(--ui-color-text-secondary)',
  'font-size': '12px',
};

export const testIdSx: JSX.CSSProperties = {
  'font-weight': 600,
  color: 'var(--ui-color-tint)',
};

/** Map report / session status strings to Badge intent. */
export function statusBadgeIntent(status: string): BadgeIntent {
  if (status === 'passed' || status === 'ready') return 'success';
  if (status === 'failed' || status === 'error') return 'destructive';
  return 'neutral';
}

/** Detail/preview panes. */
export const paneSx: JSX.CSSProperties = {
  flex: 1,
  'flex-direction': 'column',
  'min-height': 0,
  background: 'var(--ui-color-background)',
};
