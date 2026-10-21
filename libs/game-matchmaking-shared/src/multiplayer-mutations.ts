import { abortMultiplayerMutation } from './abort-multiplayer-mutation';
import { chooseMultiplayerSetupMutation } from './choose-multiplayer-setup-mutation';
import { dismissMultiplayerResultNoticeMutation } from './dismiss-result-notice-mutation';
import { findNewOpponentMutation } from './find-new-opponent-mutation';
import { findOpponentMutation } from './find-opponent-mutation';
import {
  acceptMultiplayerDrawMutation,
  declineMultiplayerDrawMutation,
  offerMultiplayerDrawMutation,
} from './multiplayer-draw-mutations';
import {
  acceptMultiplayerRematchMutation,
  declineMultiplayerRematchMutation,
  offerMultiplayerRematchMutation,
} from './multiplayer-rematch-mutations';
import { playMultiplayerMoveMutation } from './play-multiplayer-move-mutation';
import { resignMultiplayerMutation } from './resign-multiplayer-mutation';
import { settleMultiplayerClockMutation } from './settle-multiplayer-clock-mutation';
import { stopFindingOpponentMutation } from './stop-finding-opponent-mutation';

export const MULTIPLAYER_MUTATIONS = [
  findOpponentMutation,
  findNewOpponentMutation,
  stopFindingOpponentMutation,
  chooseMultiplayerSetupMutation,
  playMultiplayerMoveMutation,
  resignMultiplayerMutation,
  abortMultiplayerMutation,
  offerMultiplayerDrawMutation,
  acceptMultiplayerDrawMutation,
  declineMultiplayerDrawMutation,
  offerMultiplayerRematchMutation,
  acceptMultiplayerRematchMutation,
  declineMultiplayerRematchMutation,
  settleMultiplayerClockMutation,
  dismissMultiplayerResultNoticeMutation,
] as const;
