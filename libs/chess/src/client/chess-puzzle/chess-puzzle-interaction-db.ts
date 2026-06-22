import type { PatchDbWrite } from '@pkgs/patch-db/interface';

import { isPlayClosed } from '../../shared/chess-puzzle-derive';
import type {
  ChessPuzzleInteractionKind,
  ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import { buildFinalizePuzzlePatches } from './chess-puzzle-finalize-patches';
import { buildInteractionPatch } from './chess-puzzle-interaction-patch';

export { buildInteractionPatch } from './chess-puzzle-interaction-patch';

export async function appendPuzzleInteractionRow(
  db: PatchDbWrite,
  args: {
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    kind: ChessPuzzleInteractionKind;
    solveIdx: number;
    uci?: string | null;
    correct?: boolean | null;
  }
): Promise<void> {
  await db.write([
    buildInteractionPatch({
      entityId: crypto.randomUUID(),
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      kind: args.kind,
      solveIdx: args.solveIdx,
      uci: args.uci ?? null,
      correct: args.correct ?? null,
    }),
  ]);
}

export async function finalizePuzzlePlayWithProfile(
  db: PatchDbWrite,
  args: {
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    solveIdx: number;
    interactions: readonly ChessPuzzleInteractionRow[];
    terminalKind: 'solved' | 'abandoned';
    profileRating: number;
    profileRd: number;
  }
): Promise<void> {
  if (isPlayClosed(args.interactions, args.puzzleId)) return;
  await db.write(buildFinalizePuzzlePatches(args));
}
