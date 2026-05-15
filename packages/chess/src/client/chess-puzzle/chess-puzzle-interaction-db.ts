import { AbacEntityAttr } from '@gamezilla/patch-db/abac/abac-entity-attr';
import type { PatchDbWrite, PatchInput } from '@gamezilla/patch-db/interface';

import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  type ChessPuzzleInteractionKind,
  ChessPuzzleInteractionAttr,
  type ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';

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
      ...ChessPuzzleInteractionAttr.at(nowIso()),
      ...AbacEntityAttr.owner(args.ownerId),
    },
  };
}

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
  const {
    ownerId,
    puzzleId,
    puzzleRating,
    solveIdx,
    interactions,
    terminalKind,
    profileRating,
    profileRd,
  } = args;
  if (isPlayClosed(interactions, puzzleId)) return;

  const play = sliceCurrentPlay(interactions, puzzleId);
  const closed = [
    ...play,
    {
      puzzleId,
      kind: terminalKind,
      solveIdx,
      uci: null,
      correct: null,
      at: nowIso(),
    },
  ];
  const score = deriveOutcomeScore(closed);
  const ratingBefore = profileRating > 0 ? profileRating : 1200;
  const rdBefore = profileRd > 0 ? profileRd : 350;
  const updated = updatePuzzleRating({
    playerRating: ratingBefore,
    playerRd: rdBefore,
    puzzleRating,
    score,
  });
  const at = nowIso();

  await db.write([
    buildInteractionPatch({
      entityId: crypto.randomUUID(),
      ownerId,
      puzzleId,
      puzzleRating,
      kind: terminalKind,
      solveIdx,
    }),
    {
      entityId: ownerId,
      entityType: CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
      attributes: {
        ...ChessPuzzleProfileAttr.ownerId(ownerId),
        ...ChessPuzzleProfileAttr.rating(updated.rating),
        ...ChessPuzzleProfileAttr.ratingDev(updated.ratingDeviation),
        ...ChessPuzzleProfileAttr.lastInteractionAt(at),
        ...AbacEntityAttr.owner(ownerId),
      },
    },
  ]);
}
