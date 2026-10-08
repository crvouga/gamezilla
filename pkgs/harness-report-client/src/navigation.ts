/** Host navigation and keyboard events, scoped to one reports explorer. */
export type ReportNavigation = {
  readonly readHash: () => string;
  readonly writeHash: (hash: string, replace: boolean) => void;
  readonly subscribeHash: (listener: () => void) => () => void;
  readonly subscribeKeys: (
    listener: (event: KeyboardEvent) => void
  ) => () => void;
  readonly setTitle: (title: string) => void;
};
