/**
 * Chess table upload policies live in `apps/api` (table policies / rules).
 * Deny / mismatch codes are exported from `@libs/chess/shared/rules/codes`.
 */
export {
  CHESS_INTERACTION_DELETE_DENIED,
  CHESS_OWNER_MISMATCH,
  CHESS_PROFILE_DELETE_DENIED,
  CHESS_PROFILE_ID_MISMATCH,
  CHESS_PUZZLE_LOAD_SYSTEM_ONLY,
  CHESS_PUZZLES_SYSTEM_ONLY,
} from '@libs/chess/shared/rules/codes';
