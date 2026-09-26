export type InteractionOutcome = 'mutation' | 'request';

type PendingInteraction = {
  readonly traceparent: string;
  readonly markOutcome: (outcome: InteractionOutcome) => void;
};

let pending: PendingInteraction | null = null;
type InteractionRequestRunner = <T>(traceparent: string, run: () => T) => T;
let requestRunner: InteractionRequestRunner | null = null;
let mutationIdentity: {
  readonly sessionId: string;
  readonly buildSha: string;
} | null = null;

export function setMutationCorrelationIdentity(
  sessionId: string,
  buildSha: string
): void {
  mutationIdentity = { sessionId, buildSha };
}

export function mutationCorrelationIdentity(): typeof mutationIdentity {
  return mutationIdentity;
}

/** Browser host bridge: expose a synchronous delegated interaction to writes. */
export function setPendingInteractionCorrelation(
  interaction: PendingInteraction
): void {
  pending = interaction;
}

export function clearPendingInteractionCorrelation(traceparent: string): void {
  if (pending?.traceparent === traceparent) pending = null;
}

/** Called synchronously when mutate() is invoked, before its async tail. */
export function mutationOriginTraceparent(): string | undefined {
  const current = pending;
  if (current === null) return undefined;
  current.markOutcome('mutation');
  return current.traceparent;
}

/** Called by the browser HTTP boundary before starting an application fetch. */
export function pendingInteractionRequestTraceparent(): string | undefined {
  pending?.markOutcome('request');
  return pending?.traceparent;
}

/** Browser runtime bridge; keeps OpenTelemetry out of the sync client graph. */
export function setInteractionRequestRunner(
  runner: InteractionRequestRunner | null
): void {
  requestRunner = runner;
}

export function runInInteractionRequestContext<T>(
  traceparent: string,
  run: () => T
): T {
  return requestRunner === null ? run() : requestRunner(traceparent, run);
}
