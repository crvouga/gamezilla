import { plural, t } from '@lingui/core/macro';
import type { FrameStartReason } from './game-frame-start-reason';
import type { FrameViewerRole } from './game-frame-viewer';

/**
 * The frame's words while a custom game is set up: where the viewer stands
 * and why the game cannot start yet. Sentence case, second person.
 */

/**
 * What the frame tells someone about their place at the table, or `null`
 * when their seat and the start line say it already (the host's, and a
 * seated person's "You · guest" and "Waiting for the host to start.").
 */
export function frameViewerNotice(
  role: FrameViewerRole,
  openSeats: number
): string | null {
  switch (role) {
    case 'host':
    case 'seated':
      return null;
    case 'member':
      return t`Sit in an open seat to play, or stay to watch.`;
    case 'watcher':
      return openSeats === 0
        ? t`All seats are taken. You'll watch.`
        : t`You're watching this game.`;
  }
}

/** The start line: "Ready to start." or the one reason it cannot. */
export function frameStartLine(reason: FrameStartReason | null): string {
  if (reason === null) return t`Ready to start.`;
  switch (reason.kind) {
    case 'open-seats':
      return plural(reason.count, {
        one: '# seat is still open.',
        other: '# seats are still open.',
      });
    case 'incomplete':
      return plural(reason.count, {
        one: '# closed seat needs a player or a bot.',
        other: '# closed seats need a player or a bot.',
      });
    case 'invitations':
      return plural(reason.count, {
        one: 'Waiting for # invitation to be answered.',
        other: 'Waiting for # invitations to be answered.',
      });
    case 'unready':
      return plural(reason.count, {
        one: 'Waiting for # person to be ready.',
        other: 'Waiting for # people to be ready.',
      });
  }
}
