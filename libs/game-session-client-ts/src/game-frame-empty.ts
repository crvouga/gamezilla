import type { FrameNext, FramePlay, FrameTable } from './game-frame-view-types';

/** Nothing to tell or do in play: no game, or a viewer with no part in it. */
export const FRAME_NO_PLAY: FramePlay = {
  drawOffered: false,
  away: null,
  offerAgainLater: false,
  canOfferDraw: false,
  canAnswerDraw: false,
  canClaimWin: false,
  canResign: false,
  canCancel: false,
  boardActions: [],
};

/** No seats around the board. */
export const FRAME_NO_TABLE: FrameTable = {
  shape: 'none',
  near: null,
  others: [],
};

/** Nothing comes next. */
export const FRAME_NO_NEXT: FrameNext = {
  plays: false,
  canCreate: false,
  reviewable: false,
};
