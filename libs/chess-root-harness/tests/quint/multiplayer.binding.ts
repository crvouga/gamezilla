import { bindQuintModel } from '@pkgs/quint-shared/registry';
import offlineSpaceTrace from './fixtures/multiplayer-offline-space.itf.json';
import deletionTrace from './fixtures/multiplayer-third-device-deletion.itf.json';
import {
  askForPlay,
  changeCustomGamePlay,
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
  encoding: 'fun-arrays',
  separateInduction: true,
  regressions: [
    // regression: chess-multiplayer-offline-space-initialization
    {
      id: 'chess-multiplayer-offline-space-initialization',
      title: 'An offline device reopens multiplayer within its existing space',
      seed: '0x67932',
      itf: offlineSpaceTrace,
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
    stopFindingOpponent: stopLooking,
    matchFormed: receivePlay,
    playMove: moveInPlay,
    resignPlay: resignPlay,
    deletePlayAccount: deletePlayAccount,
    loseConnection: (w, picks) => connectPlay(w, picks, false),
    comeBackOnline: (w, picks) => connectPlay(w, picks, true),
    _customGameChanges: changeCustomGamePlay,
  },
  observe: observePlay,
  fingerprint: playFingerprint,
});
