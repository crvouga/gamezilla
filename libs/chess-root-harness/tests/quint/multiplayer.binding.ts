import { bindQuintModel } from '@pkgs/quint-shared/registry';
import reconnectionTrace from './fixtures/multiplayer-reconnection-before-auth-refresh.itf.json';
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
  moveCurrentPlay,
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
  traces: 80,
  maxSteps: 120,
  timeoutMs: 300_000,
  // Twenty actions over three people's six devices: Apalache explores two
  // steps from every reachable start within the models check's deadline.
  verifySteps: 2,
  // regression: multiplayer-bounded-proof-timeout
  boundedInvariantGroupSize: 1,
  verifyTimeoutMs: 480_000,
  // The model counts seconds (searching, clocks, the first-move wait):
  // settling in 100 ms steps would let the product's time run past it.
  settleStepMs: 1,
  regressions: [
    {
      // regression: multiplayer-reconnection-before-auth-refresh
      id: 'multiplayer-reconnection-before-auth-refresh',
      title:
        'A returning player can make the legal move on their current board',
      seed: '0x67932',
      itf: reconnectionTrace,
    },
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
    playCurrentMove: moveCurrentPlay,
    resignPlay: resignPlay,
    abortPlay: abortPlay,
    offerPlayDraw: offerPlayDraw,
    acceptPlayDraw: acceptPlayDraw,
    declinePlayDraw: declinePlayDraw,
    offerRematch: offerRematch,
    acceptRematch: acceptRematch,
    declineRematch: declineRematch,
    deletePlayAccount: deletePlayAccount,
    multiplayerTimePasses: passPlayTime,
    loseConnection: (w, picks) => connectPlay(w, picks, false),
    comeBackOnline: (w, picks) => connectPlay(w, picks, true),
  },
  observe: observePlay,
  fingerprint: playFingerprint,
});
