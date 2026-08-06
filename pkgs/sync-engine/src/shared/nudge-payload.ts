/** Nudge payload — smarter poll trigger only. Extending requires a spec update. */
export type NudgePayload = {
  readonly checkpoint?: string;
};

/** Framework channels context — identity only; product packages may pass a wider object. */
export type QueryChannelsCtx = {
  readonly actorId: string;
};
