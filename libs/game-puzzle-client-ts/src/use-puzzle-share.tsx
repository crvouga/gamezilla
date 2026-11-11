/**
 * Sharing a puzzle link: copies the stable link to the puzzle on the
 * board, finished or not, so someone else can try exactly that puzzle.
 */

import { puzzleLink } from '@libs/game-puzzle-shared-ts/puzzle-link';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useClipboard } from '@pkgs/device-client-ts/solid';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import {
  type Accessor,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import type {
  PuzzleShareModel,
  PuzzleShareState,
} from './puzzle-play-screen-model';
import { PuzzleShareLabel } from './puzzle-share-label';

/** How long "Puzzle link copied" stays before the control resets. */
const COPIED_RESET_MS = 2000;

/** The app's own origin, when it has one (a browser). */
function appOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location;
  const origin = location?.origin;
  return typeof origin === 'string' && origin.startsWith('http')
    ? origin
    : null;
}

/**
 * Sharing the puzzle `puzzleId` names: null while there is none. Copying
 * says how it went on the control for a moment, then the control resets; a
 * failed copy can be tried again at once.
 */
export function usePuzzleShare(
  puzzleId: Accessor<string | null>
): Accessor<PuzzleShareModel | null> {
  const clipboard = useClipboard();
  const timers = useTimers();
  const [state, setState] = createSignal<PuzzleShareState>('idle');
  let reset: unknown = null;
  const clearReset = (): void => {
    if (reset !== null) timers.clearTimeout(reset);
    reset = null;
  };
  onCleanup(clearReset);
  const share = (id: string): void => {
    clearReset();
    void clipboard.writeText(puzzleLink(appOrigin(), id)).then(
      () => setState('copied'),
      () => setState('failed')
    );
    reset = timers.setTimeout(() => setState('idle'), COPIED_RESET_MS);
  };
  return () => {
    const id = puzzleId();
    return id === null || id.length === 0
      ? null
      : { state: state(), onShare: () => share(id) };
  };
}

/** How copying the link went, said for someone listening to the app. */
export function PuzzleShareAnnouncement(props: {
  readonly share: PuzzleShareModel | null;
}): JSX.Element {
  return (
    <VisuallyHidden role="status" aria-live="polite">
      <Show when={props.share !== null && props.share.state !== 'idle'}>
        <PuzzleShareLabel state={props.share?.state ?? 'idle'} />
      </Show>
    </VisuallyHidden>
  );
}
