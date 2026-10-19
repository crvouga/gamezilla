import { BottomActionBar } from '@pkgs/ui-root-client/bottom-action-bar';
import { createMemo, type JSX } from 'solid-js';
import type { PuzzleActionBarModel } from './puzzle-action-bar-items';
import { buildPuzzleActionBarItems } from './puzzle-action-bar-items';

export type PuzzleActionBarProps = PuzzleActionBarModel;

export function PuzzleActionBar(props: PuzzleActionBarProps): JSX.Element {
  const items = createMemo(() =>
    buildPuzzleActionBarItems({
      status: props.status,
      hintStage: props.hintStage,
      canGoBack: props.canGoBack,
      canGoForward: props.canGoForward,
      onHint: props.onHint,
      onSolution: props.onSolution,
      onBack: props.onBack,
      onForward: props.onForward,
      onRetry: props.onRetry,
      onSkip: props.onSkip,
      onNext: props.onNext,
    })
  );
  return <BottomActionBar items={items()} />;
}
