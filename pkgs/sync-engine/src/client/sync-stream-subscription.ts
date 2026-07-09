export type SyncStreamSubscription = {
  readonly unsubscribe: () => void;
  readonly waitForFirstSync?: () => Promise<void>;
};
