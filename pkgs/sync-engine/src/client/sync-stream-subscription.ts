export type SyncStreamSubscription = {
  readonly unsubscribe: () => void;
  readonly waitForFirstSync?: (abort?: AbortSignal) => Promise<void>;
};
