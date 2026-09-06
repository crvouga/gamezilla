import type { ReactNode } from 'react';

export type AppFrameProps = {
  /** Wide-only header island (e.g. {@link AppHeaderIsland}). Ignored on compact. */
  header?: ReactNode;
  children: ReactNode;
};
