import type { ReactNode } from 'react';

import { styles, useHoverStyle } from './theme';

export type ReportHeaderBack = {
  readonly label: string;
  readonly onClick: () => void;
};

/**
 * Shared top chrome for every simulation-report screen: fixed-height bar,
 * panel fill, bottom border, trailing ⌘K.
 */
export function ReportHeader(props: {
  readonly back?: ReportHeaderBack;
  readonly title: ReactNode;
  readonly badge?: ReactNode;
  readonly meta?: ReactNode;
  /** Extra trailing controls (e.g. player transport) before ⌘K. */
  readonly end?: ReactNode;
}) {
  const { back, title, badge, meta, end } = props;
  const backHover = useHoverStyle(styles.back, styles.backHover);
  return (
    <header style={styles.appHeader}>
      {back !== undefined ? (
        <button
          type="button"
          style={backHover.style}
          onClick={back.onClick}
          onMouseEnter={backHover.onMouseEnter}
          onMouseLeave={backHover.onMouseLeave}
        >
          {back.label}
        </button>
      ) : null}
      <h1 style={styles.appHeaderTitle}>{title}</h1>
      {badge}
      {meta !== undefined && meta !== null && meta !== '' ? (
        <span style={styles.meta}>{meta}</span>
      ) : null}
      <div style={styles.appHeaderTrailing}>
        {end}
        <span style={styles.appHeaderKbd}>⌘K</span>
      </div>
    </header>
  );
}
