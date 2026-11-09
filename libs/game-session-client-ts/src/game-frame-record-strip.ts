import type { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import { captionLine } from './game-frame-status-view';
import type { FrameRecord } from './game-frame-view-types';

/** The record the frame shows: none while the game is being configured. */
export function shownRecord(
  props: GameFrameScreenViewProps
): FrameRecord | null {
  return props.phase === 'configuring' ? null : props.record;
}

/** On a narrow screen, the record of a game played by turns once it is under way. */
export function strippedRecord(
  props: GameFrameScreenViewProps,
  mode: ReturnType<typeof useLayoutMode>
): FrameRecord | null {
  const shown = shownRecord(props);
  return mode() !== 'wide' &&
    (props.phase === 'active' || props.phase === 'completed') &&
    shown !== null &&
    shown.turns
    ? shown
    : null;
}

/**
 * Beside the phone's strip, the game's own line about the turn
 * (`Red fleet fired at C4 and missed. Your turn to fire.`) heads the strip
 * instead of a pill by the board, so it is said once, under the top bar.
 * The plain `<Side> to move.` stays with the seat that says it, and a
 * warning (reconnecting, a stand-in) still shows by the board.
 */
export function stripCaption(
  props: GameFrameScreenViewProps,
  mode: ReturnType<typeof useLayoutMode>
): string | undefined {
  const status = props.status;
  if (
    props.phase !== 'active' ||
    strippedRecord(props, mode) === null ||
    status === null ||
    status.plainTurn ||
    status.tone !== 'neutral' ||
    status.description === ''
  )
    return undefined;
  return captionLine(status);
}
