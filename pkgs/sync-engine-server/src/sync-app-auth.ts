export type SyncAppAuth = {
  readonly synthetic?: boolean;
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
  readonly authenticatedAtMs?: number;
};
