/**
 * The namespace the shared game platform's stored and transmitted names keep
 * from when chess was its only game: the table domain of matched games and
 * searches, the room attributes of custom games, the outbox and notice
 * messages. It names no game — every game's custom games, matches, searches
 * and notices live under it — and renaming it would orphan stored histories,
 * pending offline mutations and queued outbox messages. It is the one
 * platform source allowed to spell a game id (`gameIdentityViolations`).
 */
export const GAME_PLATFORM_NAMESPACE = 'chess'; // @durable-name
