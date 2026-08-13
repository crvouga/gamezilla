import type { ReactNode } from 'react';

import { styles } from './theme';

/** Shared top chrome for every simulation-report screen. */
export function ReportHeader(props: {
  /** Primary left chrome — typically `<NavBreadcrumb />`. */
  readonly breadcrumb: ReactNode;
  readonly badge?: ReactNode;
  readonly meta?: ReactNode;
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
      {end != null ? <div style={styles.appHeaderTrailing}>{end}</div> : null}
    </header>
  );
}
