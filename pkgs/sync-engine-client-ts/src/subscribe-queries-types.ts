export type SyncEngineQuerySubscriptionSpec = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
};

export type SubscribeQueriesHandle = {
  readonly ready: Promise<boolean>;
  readonly unsubscribe: () => void;
};
