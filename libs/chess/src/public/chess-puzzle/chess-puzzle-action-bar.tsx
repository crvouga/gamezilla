import { BottomActionBar } from '@pkgs/ui';
import { createMemo, type JSX } from 'solid-js';

import {
  buildChessPuzzleActionBarItems,
  type ChessPuzzleActionBarModel,
} from './chess-puzzle-action-bar-items';

export type ChessPuzzleActionBarProps = ChessPuzzleActionBarModel;

export function ChessPuzzleActionBar(
  props: ChessPuzzleActionBarProps
): JSX.Element {
  const items = createMemo(() =>
    buildChessPuzzleActionBarItems({
      status: props.status,
      hintStage: props.hintStage,
      canGoBack: props.canGoBack,
      canGoForward: props.canGoForward,
      onHint: props.onHint,
      onSolution: props.onSolution,
      onBack: props.onBack,
      onForward: props.onForward,
      onRetry: props.onRetry,
      onNext: props.onNext,
    })
  );
  return <BottomActionBar items={items()} />;
}
