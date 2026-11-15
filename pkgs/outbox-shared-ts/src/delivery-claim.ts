export type ClaimRow = {
  readonly event_id: string;
  readonly consumer_id: string;
  readonly attempts: number;
  readonly available_at: string;
};
