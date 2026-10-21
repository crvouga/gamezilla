/**
 * Share a puzzle link: copies the stable link to the puzzle on the board,
 * finished or not, so someone else can try exactly that puzzle.
 */

import { puzzleLink } from '@libs/game-puzzle-shared/puzzle-link';
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { useClipboard } from '@pkgs/device-client/solid';
import { IconButton } from '@pkgs/ui-root-client/icon-button';
import { ShareIcon } from '@pkgs/ui-root-client/icons';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { createSignal, type JSX, onCleanup } from 'solid-js';

/** How long "Puzzle link copied" stays before the button resets. */
const COPIED_RESET_MS = 2000;
const BUTTON_SIZE = 32;
const ICON_SIZE = 18;

type ShareState = 'idle' | 'copied' | 'failed';

/** The app's own origin, when it has one (a browser). */
function appOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location;
  const origin = location?.origin;
  return typeof origin === 'string' && origin.startsWith('http')
    ? origin
    : null;
}

export function PuzzleShareLink(props: {
  readonly puzzleId: string;
}): JSX.Element {
  const { t } = useLingui();
  const clipboard = useClipboard();
  const timers = useTimers();
  const [state, setState] = createSignal<ShareState>('idle');
  let reset: unknown = null;
  const clearReset = (): void => {
    if (reset !== null) timers.clearTimeout(reset);
    reset = null;
  };
  onCleanup(clearReset);
  const share = (): void => {
    clearReset();
    void clipboard.writeText(puzzleLink(appOrigin(), props.puzzleId)).then(
      () => setState('copied'),
      () => setState('failed')
    );
    reset = timers.setTimeout(() => setState('idle'), COPIED_RESET_MS);
  };
  const label = (): string =>
    state() === 'copied'
      ? t`Puzzle link copied`
      : state() === 'failed'
        ? t`Couldn't copy the puzzle link`
        : t`Share puzzle link`;
  return (
    <>
      <IconButton
        label={label()}
        size={BUTTON_SIZE}
        flashTooltipOnClick
        onClick={share}
        dataSet={{ testid: Handles.chessPuzzleShareLink }}
      >
        <ShareIcon size={ICON_SIZE} />
      </IconButton>
      <VisuallyHidden role="status" aria-live="polite">
        {state() === 'idle' ? '' : label()}
      </VisuallyHidden>
    </>
  );
}
