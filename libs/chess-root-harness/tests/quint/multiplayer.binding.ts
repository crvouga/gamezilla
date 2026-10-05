import { bindQuintModel } from '@pkgs/quint-shared/registry';
import deletionTrace from './fixtures/multiplayer-third-device-deletion.itf.json';
import {
  abortPlay,
  acceptPlayDraw,
  acceptRematch,
  askAgain,
  askForPlay,
  connectPlay,
  declinePlayDraw,
  declineRematch,
  deletePlayAccount,
  initPlay,
  moveInPlay,
  offerPlayDraw,
  offerRematch,
  passPlayTime,
  playFingerprint,
  receivePlay,
  resignPlay,
  showPlay,
  stopLooking,
} from './multiplayer-actions';
import { observePlay } from './multiplayer-observe';
import type { PlayTrace } from './multiplayer-world';

bindQuintModel<PlayTrace>({
  model: 'multiplayer',
  traces: 8,
  maxSteps: 40,
  timeoutMs: 300_000,
  // Nineteen actions over three people's six devices: Apalache explores two
  // steps from every reachable start within the models check's deadline.
  verifySteps: 2,
  verifyTimeoutMs: 480_000,
  encoding: 'fun-arrays',
  regressions: [
    // regression: chess-deletion-refreshes-connected-devices
    {
      id: 'multiplayer-third-device-deletion',
      title:
        'A deletion clears connected devices and preserves the offline board',
      seed: '0x67932',
      itf: deletionTrace,
    },
  ],
  actions: {
    init: initPlay,
    openMultiplayer: showPlay,
    findOpponent: askForPlay,
    findNewOpponent: askAgain,
    stopFindingOpponent: stopLooking,
    matchFormed: receivePlay,
    playMove: moveInPlay,
    resignPlay,
    abortPlay,
    offerPlayDraw,
    acceptPlayDraw,
    declinePlayDraw,
    offerRematch,
    acceptRematch,
    declineRematch,
    deletePlayAccount,
    multiplayerTimePasses: passPlayTime,
    loseConnection: (w, picks) => connectPlay(w, picks, false),
    comeBackOnline: (w, picks) => connectPlay(w, picks, true),
  },
  observe: observePlay,
  fingerprint: playFingerprint,
});
