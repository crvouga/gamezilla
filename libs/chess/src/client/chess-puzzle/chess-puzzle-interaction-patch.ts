import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import type { PatchInput } from '@pkgs/patch-db/interface';

import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  type ChessPuzzleInteractionKind,
  ChessPuzzleInteractionAttr,
} from '../../shared/chess-puzzle-interaction-entities';

function nowIso(): string {
  return new Date().toISOString();
}

export function buildInteractionPatch(args: {
  entityId: string;
  ownerId: string;
  puzzleId: string;
  puzzleRating: number;
  kind: ChessPuzzleInteractionKind;
  solveIdx: number;
  uci?: string | null;
  correct?: boolean | null;
  ratingBefore?: number;
  ratingAfter?: number;
}): PatchInput {
  return {
    entityId: args.entityId,
    entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
    attributes: {
      ...ChessPuzzleInteractionAttr.ownerId(args.ownerId),
      ...ChessPuzzleInteractionAttr.puzzleId(args.puzzleId),
      ...ChessPuzzleInteractionAttr.puzzleRating(args.puzzleRating),
      ...ChessPuzzleInteractionAttr.kind(args.kind),
      ...ChessPuzzleInteractionAttr.solveIdx(args.solveIdx),
      ...ChessPuzzleInteractionAttr.uci(args.uci ?? null),
      ...ChessPuzzleInteractionAttr.correct(args.correct ?? null),
      ...ChessPuzzleInteractionAttr.ratingBefore(args.ratingBefore ?? 0),
      ...ChessPuzzleInteractionAttr.ratingAfter(args.ratingAfter ?? 0),
      ...ChessPuzzleInteractionAttr.at(nowIso()),
      ...AbacEntityAttr.owner(args.ownerId),
    },
  };
}
