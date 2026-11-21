import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import {
  AVERY,
  FRAME_PLAYING,
  JORDAN,
  playSeat,
  status,
} from './game-frame-story.example';

/**
 * Story-only fixtures for the Spaces table's guest cells once a game is
 * played: the frame's two-seat game as jordan_plays, the space's guest,
 * sees it. The host (avery) is to move, so the guest's own seat waits
 * below the board; the host's `FRAME_PLAYING` is the same game from the
 * other seat.
 */
export const GUEST_SEAT_VIEW = {
  viewerSide: 'black',
  status: status({ emphasis: 'neutral' }),
  table: {
    shape: 'strip',
    near: playSeat(JORDAN),
    others: [playSeat(AVERY, { deciding: true })],
  },
} satisfies Partial<GameFrameScreenViewProps>;

/** The two-seat game in play, from the guest's seat. */
export const FRAME_PLAYING_GUEST: Partial<GameFrameScreenViewProps> = {
  ...FRAME_PLAYING,
  ...GUEST_SEAT_VIEW,
};
