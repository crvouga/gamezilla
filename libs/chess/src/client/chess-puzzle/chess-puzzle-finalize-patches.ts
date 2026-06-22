import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import type { PatchInput } from '@pkgs/patch-db/interface';

import { deriveOutcomeScore, sliceCurrentPlay } from '../../shared/chess-puzzle-derive';
import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';
import { buildInteractionPatch } from './chess-puzzle-interaction-patch';

function nowIso(): string {
  return new Date().toISOString();
}

export function buildFinalizePuzzlePatches(args: {
  ownerId: string;
  puzzleId: string;
  puzzleRating: number;
  solveIdx: number;
  interactions: readonly ChessPuzzleInteractionRow[];
  terminalKind: 'solved' | 'abandoned';
  profileRating: number;
  profileRd: number;
}): PatchInput[] {
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const closed = [
    ...play,
    {
      puzzleId: args.puzzleId,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      uci: null,
      correct: null,
      puzzleRating: args.puzzleRating,
      ratingBefore: 0,
      ratingAfter: 0,
      at: nowIso(),
    },
  ];
  const ratingBefore = args.profileRating > 0 ? args.profileRating : 1200;
  const rdBefore = args.profileRd > 0 ? args.profileRd : 350;
  const updated = updatePuzzleRating({
    playerRating: ratingBefore,
    playerRd: rdBefore,
    puzzleRating: args.puzzleRating,
    score: deriveOutcomeScore(closed),
  });
  const at = nowIso();
  return [
    buildInteractionPatch({
      entityId: crypto.randomUUID(),
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      ratingBefore,
      ratingAfter: updated.rating,
    }),
    {
      entityId: args.ownerId,
      entityType: CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
      attributes: {
        ...ChessPuzzleProfileAttr.ownerId(args.ownerId),
        ...ChessPuzzleProfileAttr.rating(updated.rating),
        ...ChessPuzzleProfileAttr.ratingDev(updated.ratingDeviation),
        ...ChessPuzzleProfileAttr.lastInteractionAt(at),
        ...AbacEntityAttr.owner(args.ownerId),
      },
    },
  ];
}
