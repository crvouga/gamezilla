import {
  createAssistantDialogueTreeRenderer,
  createSystemClock,
} from '@gamezilla/assistant/client';
import {
  createAssistant,
  type Assistant,
  type AssistantSignal,
} from '@gamezilla/assistant/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { SolveStatus } from '../chess-puzzle/use-chess-puzzle-solver';
import {
  buildChessPuzzleDialogueContext,
  type ChessPuzzleDialogueBoardContext,
} from './build-chess-puzzle-dialogue-context';
import {
  createChessPuzzleGameAdapter,
  type ChessPuzzleAssistantPayload,
} from './chess-puzzle-assistant-adapter';
import { buildChessPuzzleAssistantSignal } from './chess-puzzle-assistant-build-signal';
import { CHESS_PUZZLE_DIALOGUE_TREE } from './chess-puzzle-dialogue-tree';
import { useChessPuzzleAssistantObserve } from './use-chess-puzzle-assistant-observe';

function useLatestRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function useChessPuzzleAssistant(args: {
  readonly puzzleId: string;
  readonly status: SolveStatus;
  readonly solveIdx: number;
  readonly themes: readonly string[];
  readonly layoutKey: number;
  readonly board: ChessPuzzleDialogueBoardContext;
}): Assistant<ChessPuzzleAssistantPayload> {
  const prevStatusRef = useRef<SolveStatus | null>(null);
  const themesRef = useLatestRef(args.themes);
  const boardRef = useLatestRef(args.board);
  const assistantRef = useRef<Assistant<ChessPuzzleAssistantPayload> | null>(
    null
  );

  const assistant = useMemo((): Assistant<ChessPuzzleAssistantPayload> => {
    const renderer = createAssistantDialogueTreeRenderer({
      getAssistant: () => assistantRef.current,
      tree: CHESS_PUZZLE_DIALOGUE_TREE,
      clock: createSystemClock(),
      rngSeed: args.puzzleId,
      contextFromAction: (action) =>
        buildChessPuzzleDialogueContext({
          action,
          board: {
            ...boardRef.current,
            themes: themesRef.current,
          },
        }),
    });
    const inst = createAssistant<ChessPuzzleAssistantPayload>({
      adapter: createChessPuzzleGameAdapter(),
      clock: createSystemClock(),
      seed: args.puzzleId,
      renderer,
    });
    assistantRef.current = inst;
    return inst;
  }, [args.puzzleId, boardRef, themesRef]);

  const themesKey = args.themes.join('\u0000');

  const buildSignal =
    useCallback((): AssistantSignal<ChessPuzzleAssistantPayload> | null => {
      void themesKey;
      return buildChessPuzzleAssistantSignal({
        prevStatus: prevStatusRef.current,
        status: args.status,
        solveIdx: args.solveIdx,
        themes: themesRef.current,
      });
    }, [args.status, args.solveIdx, themesKey, themesRef]);

  useChessPuzzleAssistantObserve({
    assistant,
    buildSignal,
    puzzleId: args.puzzleId,
    status: args.status,
    solveIdx: args.solveIdx,
    themesKey,
    layoutKey: args.layoutKey,
  });

  useEffect(() => {
    prevStatusRef.current = args.status;
  }, [args.status]);

  return assistant;
}

export type { ChessPuzzleDialogueBoardContext };
