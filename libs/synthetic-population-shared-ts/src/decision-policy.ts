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
  /** Games where a person waits for this Synthetic User as their opponent. */
  readonly waitingOpponents?: readonly OpponentDemand[];
};
/** A person looking for a multiplayer opponent: the game and the match choice. */
export type OpponentDemand = {
  readonly gameId: string;
  readonly timeControl: string;
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
  /** The game to find an opponent for, when a person is waiting for one. */
  game?: OpponentDemand;
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
  // A person waiting for an opponent comes before anything a Synthetic User fancies.
  const waiting = input.waitingOpponents?.[0];
  if (waiting !== undefined)
    return { activity: 'matchmaking', targetControlId: null, game: waiting };
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
