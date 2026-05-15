import { emitAssistantSpeakingMessage } from '@gamezilla/assistant/client';
import type { Assistant, AssistantSignal } from '@gamezilla/assistant/shared';
import { useEffect, useRef } from 'react';

import type { ChessPuzzleAssistantPayload } from './chess-puzzle-assistant-adapter';
import type { SolveStatus } from '../chess-puzzle/use-chess-puzzle-solver';

export function useChessPuzzleAssistantObserve(args: {
  readonly assistant: Assistant<ChessPuzzleAssistantPayload>;
  readonly buildSignal: () => AssistantSignal<ChessPuzzleAssistantPayload> | null;
  readonly puzzleId: string;
  readonly status: SolveStatus;
  readonly solveIdx: number;
  readonly themesKey: string;
  readonly layoutKey: number;
}): void {
  const {
    assistant,
    buildSignal,
    puzzleId,
    status,
    solveIdx,
    themesKey,
    layoutKey,
  } = args;

  const lastSignalFpRef = useRef('');

  useEffect(() => {
    lastSignalFpRef.current = '';
  }, [puzzleId]);

  useEffect(() => {
    const s = buildSignal();
    if (s === null) {
      emitAssistantSpeakingMessage(assistant, null, {
        bubbleResolving: false,
      });
      return;
    }
    const fp = `${puzzleId}:${s.kind}:${themesKey}:${solveIdx}:${layoutKey}`;
    if (fp === lastSignalFpRef.current) {
      return;
    }
    lastSignalFpRef.current = fp;
    assistant.observe(s);
  }, [
    assistant,
    buildSignal,
    puzzleId,
    status,
    solveIdx,
    themesKey,
    layoutKey,
  ]);
}
