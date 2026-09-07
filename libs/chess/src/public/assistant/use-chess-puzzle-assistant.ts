import {
  createAssistantDialogueTreeRenderer,
  createSystemClock,
} from '@pkgs/assistant/client';
import {
  type Assistant,
  type AssistantSignal,
  createAssistant,
} from '@pkgs/assistant/shared';
import { useClock, useTimers } from '@pkgs/clock/solid';
import { type Accessor, createEffect, createMemo } from 'solid-js';

import type { SolveStatus } from '../chess-puzzle/use-chess-puzzle-solver';
import {
  buildChessPuzzleDialogueContext,
  type ChessPuzzleDialogueBoardContext,
} from './build-chess-puzzle-dialogue-context';
import {
  type ChessPuzzleAssistantPayload,
  createChessPuzzleGameAdapter,
} from './chess-puzzle-assistant-adapter';
import { buildChessPuzzleAssistantSignal } from './chess-puzzle-assistant-build-signal';
import { CHESS_PUZZLE_DIALOGUE_TREE } from './chess-puzzle-dialogue-tree';
import { useChessPuzzleAssistantObserve } from './use-chess-puzzle-assistant-observe';

export function useChessPuzzleAssistant(args: {
  readonly puzzleId: Accessor<string>;
  readonly status: Accessor<SolveStatus>;
  readonly solveIdx: Accessor<number>;
  readonly themes: Accessor<readonly string[]>;
  readonly layoutKey: Accessor<number>;
  readonly board: Accessor<ChessPuzzleDialogueBoardContext>;
}): Accessor<Assistant<ChessPuzzleAssistantPayload>> {
  const clock = useClock();
  const timers = useTimers();
  const prevStatusRef: { current: SolveStatus | null } = { current: null };
  const themesRef: { current: readonly string[] } = { current: [] };
  const boardRef: {
    current: ChessPuzzleDialogueBoardContext;
  } = {
    current: {
      orientation: 'white',
      displayFen: null,
      solveIdx: 0,
      totalTokens: 0,
      wrongFromSquare: null,
      wrongToSquare: null,
    },
  };
  const assistantRef: {
    current: Assistant<ChessPuzzleAssistantPayload> | null;
  } = { current: null };

  createEffect(() => {
    themesRef.current = args.themes();
  });
  createEffect(() => {
    boardRef.current = args.board();
  });

  const assistant = createMemo<Assistant<ChessPuzzleAssistantPayload>>(() => {
    const puzzleId = args.puzzleId();
    const assistantClock = createSystemClock({ clock, timers });
    const renderer = createAssistantDialogueTreeRenderer({
      getAssistant: () => assistantRef.current,
      tree: CHESS_PUZZLE_DIALOGUE_TREE,
      clock: assistantClock,
      rngSeed: puzzleId,
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
      clock: assistantClock,
      seed: puzzleId,
      renderer,
    });
    assistantRef.current = inst;
    return inst;
  });

  const themesKey = createMemo(() => args.themes().join('\u0000'));

  const buildSignal = (): AssistantSignal<ChessPuzzleAssistantPayload> | null =>
    buildChessPuzzleAssistantSignal({
      prevStatus: prevStatusRef.current,
      status: args.status(),
      solveIdx: args.solveIdx(),
      themes: themesRef.current,
    });

  useChessPuzzleAssistantObserve({
    assistant,
    buildSignal,
    puzzleId: args.puzzleId,
    status: args.status,
    solveIdx: args.solveIdx,
    themesKey,
    layoutKey: args.layoutKey,
  });

  createEffect(() => {
    prevStatusRef.current = args.status();
  });

  return assistant;
}

export type { ChessPuzzleDialogueBoardContext };
