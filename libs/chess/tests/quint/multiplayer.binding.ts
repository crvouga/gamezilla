import { bindQuintModel } from '@pkgs/quint/registry';
import {
  askForPlay,
  connectPlay,
  deletePlayAccount,
  initPlay,
  moveInPlay,
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
  traces: 256,
  maxSteps: 300,
  timeoutMs: 180_000,
  inductiveInvariant: '_proof',
  actions: {
    init: initPlay,
    openMultiplayer: showPlay,
    findOpponent: askForPlay,
    stopFindingOpponent: stopLooking,
    matchFormed: receivePlay,
    playMove: moveInPlay,
    resignPlay,
    deletePlayAccount,
    loseConnection: (w, picks) => connectPlay(w, picks, false),
    comeBackOnline: (w, picks) => connectPlay(w, picks, true),
  },
  observe: observePlay,
  fingerprint: playFingerprint,
});
