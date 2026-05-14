import {
  createSystemClock,
  emitAssistantSpeakingMessage,
} from '@gamezilla/assistant/client';
import {
  createAssistant,
  type Assistant,
  type AssistantAction,
  type AssistantSignal,
} from '@gamezilla/assistant/shared';
import { useLingui } from '@lingui/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { SolveStatus } from '../chess-puzzle/use-chess-puzzle-solver';
import {
  createChessPuzzleGameAdapter,
  type ChessPuzzleAssistantPayload,
} from './chess-puzzle-assistant-adapter';
import { buildChessPuzzleAssistantSignal } from './chess-puzzle-assistant-build-signal';
import { renderChessPuzzleAssistantAction } from './chess-puzzle-assistant-render-action';
import { useChessPuzzleAssistantObserve } from './use-chess-puzzle-assistant-observe';

export function useChessPuzzleAssistant(args: {
  readonly puzzleId: string;
  readonly status: SolveStatus;
  readonly solveIdx: number;
  readonly themes: readonly string[];
  readonly layoutKey: number;
}): Assistant<ChessPuzzleAssistantPayload> {
  const lingui = useLingui();
  const i18nRef = useRef(lingui.i18n);
  i18nRef.current = lingui.i18n;
  const prevStatusRef = useRef<SolveStatus | null>(null);
  const themesRef = useRef(args.themes);
  themesRef.current = args.themes;

  const assistant = useMemo((): Assistant<ChessPuzzleAssistantPayload> => {
    const inst = createAssistant<ChessPuzzleAssistantPayload>({
      adapter: createChessPuzzleGameAdapter(),
      clock: createSystemClock(),
      seed: args.puzzleId,
      renderer: {
        render(action: AssistantAction): void {
          renderChessPuzzleAssistantAction(
            action,
            (m) => i18nRef.current._(m),
            (m) => emitAssistantSpeakingMessage(inst, m)
          );
        },
      },
    });
    return inst;
  }, [args.puzzleId]);

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
    }, [args.status, args.solveIdx, themesKey]);

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
