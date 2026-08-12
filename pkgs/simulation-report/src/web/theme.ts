import {
  type CSSProperties,
  type MouseEventHandler,
  useCallback,
  useState,
} from 'react';

import { styles } from './theme-styles';
import { merge, t } from './theme-tokens';

export { styles } from './theme-styles';
export { merge, t } from './theme-tokens';

export function useHoverStyle(
  base: CSSProperties,
  hover: CSSProperties,
  disabled = false
): {
  readonly style: CSSProperties;
  readonly onMouseEnter: MouseEventHandler;
  readonly onMouseLeave: MouseEventHandler;
} {
  const [hovered, setHovered] = useState(false);
  const onMouseEnter = useCallback(() => {
    if (!disabled) setHovered(true);
  }, [disabled]);
  const onMouseLeave = useCallback(() => setHovered(false), []);
  return {
    style: merge(base, hovered && !disabled ? hover : null),
    onMouseEnter,
    onMouseLeave,
  };
}

/** ~1.4s ease-in-out pulse matching former rail-hold-pulse keyframes. */
export function holdPulseOpacity(nowMs: number): number {
  return 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((nowMs / 1400) * Math.PI * 2));
}

export function badgeStyle(status: string): CSSProperties {
  if (status === 'passed') return merge(styles.badge, styles.badgePassed);
  if (status === 'failed') return merge(styles.badge, styles.badgeFailed);
  return styles.badge;
}

export function applyDocumentChrome(): void {
  const chrome: CSSProperties = {
    margin: 0,
    height: '100%',
    background: t.bg,
    color: t.text,
    font: `13px / 1.45 ${t.mono}`,
    boxSizing: 'border-box',
  };
  Object.assign(document.documentElement.style, chrome);
  Object.assign(document.body.style, chrome);
  const root = document.getElementById('root');
  if (root) Object.assign(root.style, chrome);
}
