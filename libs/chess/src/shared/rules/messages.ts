import {
  CHESS_INTERACTION_DELETE_DENIED,
  CHESS_OWNER_MISMATCH,
  CHESS_PROFILE_DELETE_DENIED,
  CHESS_PROFILE_ID_MISMATCH,
  CHESS_PUZZLE_LOAD_SYSTEM_ONLY,
  CHESS_PUZZLES_SYSTEM_ONLY,
} from './codes';

export const CHESS_MESSAGES = {
  [CHESS_OWNER_MISMATCH]: 'owner mismatch',
  [CHESS_PROFILE_ID_MISMATCH]: 'id mismatch',
  [CHESS_PROFILE_DELETE_DENIED]: 'puzzle profiles cannot be deleted via sync',
  [CHESS_INTERACTION_DELETE_DENIED]:
    'puzzle interactions cannot be deleted via sync',
  [CHESS_PUZZLES_SYSTEM_ONLY]: 'write denied',
  [CHESS_PUZZLE_LOAD_SYSTEM_ONLY]: 'write denied',
} as const satisfies Readonly<Record<string, string>>;
