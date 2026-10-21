import type { Random } from '@pkgs/uuid-shared-ts/create-id';

export type PolicyInputs = {
  readonly hasActiveMatch: boolean;
  readonly hasQueueEntry: boolean;
  readonly availableSpaces: readonly string[];
  readonly paused: boolean;
  readonly draining: boolean;
  readonly sessionElapsedMs: number;
  readonly sessionLimitMs: number;
  readonly hostingWeight: number;
};
export type Decision = {
  activity:
    | 'playing'
    | 'matchmaking'
    | 'browsing'
    | 'hosting'
    | 'joining'
    | 'loggingOut';
  targetControlId: string | null;
};

/** Authoritative ongoing activity always wins over a new random decision. */
export function chooseActivity(input: PolicyInputs, random: Random): Decision {
  if (input.hasActiveMatch)
    return { activity: 'playing', targetControlId: null };
  if (
    input.paused ||
    input.draining ||
    input.sessionElapsedMs >= input.sessionLimitMs
  )
    return { activity: 'loggingOut', targetControlId: null };
  if (input.hasQueueEntry)
    return { activity: 'matchmaking', targetControlId: null };
  const choice = random();
  if (input.availableSpaces.length > 0 && choice < 0.4) {
    const index = Math.min(
      input.availableSpaces.length - 1,
      Math.floor(random() * input.availableSpaces.length)
    );
    return {
      activity: 'joining',
      targetControlId: input.availableSpaces[index] ?? null,
    };
  }
  if (choice < Math.max(0, Math.min(1, input.hostingWeight)))
    return { activity: 'hosting', targetControlId: null };
  return {
    activity: choice < 0.9 ? 'matchmaking' : 'browsing',
    targetControlId: null,
  };
}
