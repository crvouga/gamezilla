import { Spinner } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type ChessPuzzleBoardLoadingStateProps = {
  size?: number;
};

export function ChessPuzzleBoardLoadingState(
  props: ChessPuzzleBoardLoadingStateProps = {}
): JSX.Element {
  const dimensionSx =
    props.size !== undefined
      ? { width: `${props.size}px`, height: `${props.size}px` }
      : { width: '100%' as const, 'aspect-ratio': '1' };
  return (
    <div
      class="box self-center bg-surface items-center justify-center"
      style={dimensionSx}
    >
      <Spinner size="large" />
    </div>
  );
}
