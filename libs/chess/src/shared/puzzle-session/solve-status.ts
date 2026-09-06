import type { ChessPuzzlePlayStatus } from '../chess/chess-puzzle-play';

/**
 * UI-facing status. `'loading'` is a client-side projection of the room's
 * `'idle'` status — there is no separate `'loading'` state on the wire.
 */
export type SolveStatus = 'loading' | ChessPuzzlePlayStatus;
