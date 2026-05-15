import { useMyId } from '@gamezilla/auth/client/use-current-user';
import { AbacEntityAttr } from '@gamezilla/patch-db/abac/abac-entity-attr';
import type { PatchInput } from '@gamezilla/patch-db/interface';
import { useEntityAttribute, usePatchDb } from '@gamezilla/patch-db/react';
import { useCallback, useEffect, useRef } from 'react';

import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  CHESS_PUZZLE_INTERACTION_KIND,
  ChessPuzzleInteractionAttr,
  type ChessPuzzleInteractionKind,
  type ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';

export type InteractionRecorderArgs = {
  puzzleId: string;
  puzzleRating: number;
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  interactions: readonly ChessPuzzleInteractionRow[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function interactionPatch(args: {
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

/**
 * Appends interaction rows on room transitions; updates profile on terminal events.
 */
export function useChessPuzzleInteractionRecorder(
  args: InteractionRecorderArgs
): {
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  setLastUci: (uci: string) => void;
} {
  const { puzzleId, puzzleRating, status, solveIdx, interactions } = args;
  const db = usePatchDb();
  const myId = useMyId();
  const profileRating = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.rating
  );
  const profileRd = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.ratingDev
  );

  const prevStatusRef = useRef<ChessPuzzlePlayStatus | 'loading' | null>(null);
  const prevSolveIdxRef = useRef<number | null>(null);
  const lastUciRef = useRef<string | null>(null);

  const appendInteraction = useCallback(
    async (
      kind: ChessPuzzleInteractionKind,
      extra?: {
        uci?: string | null;
        correct?: boolean | null;
        solveIdx?: number;
      }
    ) => {
      if (myId.length === 0) return;
      await db.write([
        interactionPatch({
          entityId: crypto.randomUUID(),
          ownerId: myId,
          puzzleId,
          puzzleRating,
          kind,
          solveIdx: extra?.solveIdx ?? solveIdx,
          uci: extra?.uci ?? null,
          correct: extra?.correct ?? null,
        }),
      ]);
    },
    [db, myId, puzzleId, puzzleRating, solveIdx]
  );

  const finalizePlay = useCallback(
    async (terminalKind: 'solved' | 'abandoned') => {
      if (myId.length === 0) return;
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
        interactionPatch({
          entityId: crypto.randomUUID(),
          ownerId: myId,
          puzzleId,
          puzzleRating,
          kind: terminalKind,
          solveIdx,
        }),
        {
          entityId: myId,
          entityType: CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
          attributes: {
            ...ChessPuzzleProfileAttr.ownerId(myId),
            ...ChessPuzzleProfileAttr.rating(updated.rating),
            ...ChessPuzzleProfileAttr.ratingDev(updated.ratingDeviation),
            ...ChessPuzzleProfileAttr.lastInteractionAt(at),
            ...AbacEntityAttr.owner(myId),
          },
        },
      ]);
    },
    [
      db,
      interactions,
      myId,
      profileRating,
      profileRd,
      puzzleId,
      puzzleRating,
      solveIdx,
    ]
  );

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (myId.length === 0 || status === 'loading') return;

    if (prev === null || prev === 'loading') {
      if (status === CHESS_PUZZLE_PLAY_STATUS.solving) {
        void appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.started);
      }
      return;
    }

    if (
      prev === CHESS_PUZZLE_PLAY_STATUS.solving &&
      status === CHESS_PUZZLE_PLAY_STATUS.wrong
    ) {
      void appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.moved, {
        uci: lastUciRef.current,
        correct: false,
        solveIdx: prevSolveIdxRef.current ?? solveIdx,
      });
    }

    if (
      prev === CHESS_PUZZLE_PLAY_STATUS.solving &&
      status === CHESS_PUZZLE_PLAY_STATUS.solving &&
      prevSolveIdxRef.current !== null &&
      solveIdx > prevSolveIdxRef.current
    ) {
      void appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.moved, {
        uci: lastUciRef.current,
        correct: true,
        solveIdx: prevSolveIdxRef.current,
      });
    }

    if (status === CHESS_PUZZLE_PLAY_STATUS.solved && prev !== 'solved') {
      void finalizePlay('solved');
    }
  }, [appendInteraction, finalizePlay, myId, solveIdx, status]);

  useEffect(() => {
    prevSolveIdxRef.current = solveIdx;
  }, [solveIdx]);

  const setLastUci = useCallback((uci: string) => {
    lastUciRef.current = uci;
  }, []);

  const appendUsedHint = useCallback(async () => {
    await appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.usedHint);
  }, [appendInteraction]);

  const appendAbandoned = useCallback(async () => {
    await finalizePlay('abandoned');
  }, [finalizePlay]);

  return { appendUsedHint, appendAbandoned, setLastUci };
}
