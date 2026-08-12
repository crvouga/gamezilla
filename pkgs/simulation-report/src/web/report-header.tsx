import type { ReactNode } from 'react';

import { styles } from './theme';

/**
 * Shared top chrome for every simulation-report screen: fixed-height bar,
 * panel fill, bottom border, trailing ⌘K.
 */
export function ReportHeader(props: {
  /** Primary left chrome — typically `<NavBreadcrumb />`. */
  readonly breadcrumb: ReactNode;
  readonly badge?: ReactNode;
  readonly meta?: ReactNode;
  /** Extra trailing controls (e.g. copy LLM) before ⌘K. */
  readonly end?: ReactNode;
}) {
  const { breadcrumb, badge, meta, end } = props;
  return (
    <header style={styles.appHeader}>
      {breadcrumb}
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
