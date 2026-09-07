import { emitAssistantSpeakingMessage } from '@pkgs/assistant/client';
import type { Assistant, AssistantSignal } from '@pkgs/assistant/shared';
import { type Accessor, createEffect } from 'solid-js';

import type { SolveStatus } from '../chess-puzzle/use-chess-puzzle-solver';
import type { ChessPuzzleAssistantPayload } from './chess-puzzle-assistant-adapter';

export function useChessPuzzleAssistantObserve(args: {
  readonly assistant: Accessor<Assistant<ChessPuzzleAssistantPayload>>;
  readonly buildSignal: () => AssistantSignal<ChessPuzzleAssistantPayload> | null;
  readonly puzzleId: Accessor<string>;
  readonly status: Accessor<SolveStatus>;
  readonly solveIdx: Accessor<number>;
  readonly themesKey: Accessor<string>;
  readonly layoutKey: Accessor<number>;
}): void {
  const lastSignalFpRef: { current: string } = { current: '' };

  createEffect(() => {
    void args.puzzleId();
    lastSignalFpRef.current = '';
  });

  createEffect(() => {
    const assistant = args.assistant();
    const s = args.buildSignal();
    if (s === null) {
      if (args.status() === 'loading') {
        emitAssistantSpeakingMessage(assistant, null, {
          bubbleResolving: false,
        });
      }
      return;
    }
    const fp = `${args.puzzleId()}:${s.kind}:${args.themesKey()}:${args.solveIdx()}:${args.layoutKey()}`;
    if (fp === lastSignalFpRef.current) {
      return;
    }
    lastSignalFpRef.current = fp;
    assistant.observe(s);
  });
}
