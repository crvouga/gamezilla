import { Spinner } from '@pkgs/ui-root-client/spinner';
import type { JSX } from 'solid-js';

export type PuzzleBoardLoadingStateProps = {
  size?: number;
};

export function PuzzleBoardLoadingState(
  props: PuzzleBoardLoadingStateProps = {}
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
