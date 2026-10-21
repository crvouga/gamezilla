import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import reconnectionTrace from './fixtures/multiplayer-reconnection-before-auth-refresh.itf.json';
import deletionTrace from './fixtures/multiplayer-third-device-deletion.itf.json';
import {
  abortGame,
  acceptDraw,
  acceptRematch,
  connectPlay,
  declineDraw,
  declineRematch,
  deleteAccount,
  findNewOpponent,
  initPlay,
  offerDraw,
  offerRematch,
  openOwnFindingAnOpponent,
  pairPeopleUp,
  playCurrentMove,
  playFingerprint,
  playMove,
  resignGame,
  secondsPass,
  seekOpponent,
  stopSeeking,
} from './matched-game-actions';
import type { PlayTrace } from './matched-game-model-world';
import { observePlay } from './matched-game-observe';

bindQuintModel<PlayTrace>({
  model: 'matched-game',
  traces: 80,
  maxSteps: 120,
  timeoutMs: 300_000,
  // Twenty actions over three people's six devices: Apalache explores two
  // steps from every reachable start within the models check's deadline.
  verifySteps: 2,
  // regression: multiplayer-bounded-proof-timeout
  boundedInvariantGroupSize: 1,
  // Both schedules prove every successor; check the invariant before advancing.
  invariantMode: 'before',
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
    openFindingAnOpponent: openOwnFindingAnOpponent,
    seekOpponent,
    findNewOpponent,
    stopSeeking,
    pairPeopleUp,
    playMove,
    playCurrentMove,
    resignGame,
    abortGame,
    offerDraw,
    acceptDraw,
    declineDraw,
    offerRematch,
    acceptRematch,
    declineRematch,
    deleteAccount,
    secondsPass,
    loseConnection: (w, picks) => connectPlay(w, picks, false),
    comeBackOnline: (w, picks) => connectPlay(w, picks, true),
  },
  observe: observePlay,
  fingerprint: playFingerprint,
});
