import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import type { PuzzleShareState } from './puzzle-play-screen-model';

/** What the share control says: the command, then how copying went. */
export function usePuzzleShareLabel(): (state: PuzzleShareState) => string {
  const { t } = useLingui();
  return (state) =>
    state === 'copied'
      ? t`Puzzle link copied`
      : state === 'failed'
        ? t`Couldn't copy. Try again`
        : t`Share puzzle link`;
}

/** {@link usePuzzleShareLabel} as text. */
export function PuzzleShareLabel(props: {
  readonly state: PuzzleShareState;
}): JSX.Element {
  const label = usePuzzleShareLabel();
  return <>{label(props.state)}</>;
}
