import type { JSX } from 'solid-js';

/** Full-height shell: fill parent, product background. */
export const appShellSx: JSX.CSSProperties = {
  flex: 1,
  'flex-direction': 'column',
  'min-height': 0,
  background: 'var(--ui-color-background)',
};
