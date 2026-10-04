import styles from '@pkgs/chess-board-root-client/chess-board.module.css';
import { Chess } from 'chess.js';
import type { BoardWorld } from './board-world';
import type { PairApp } from './pair-world';
import { pairOf } from './pair-world';
import { INITIAL, REPLACEMENT } from './positions';

const moved = new Chess(INITIAL);
moved.move('e4');
const positions = new Map([
  [new Chess(INITIAL).fen(), 'opening'],
  [moved.fen(), 'moved'],
  [new Chess(REPLACEMENT).fen(), 'replacement'],
]);
export function readSeparateBoard(app: PairApp) {
  const present = !app.closed();
  const probe = present ? app.probe() : undefined;
  const position = present
    ? positions.get(new Chess(probe?.fen).fen())
    : 'absent';
  if (position === undefined)
    throw new Error('Unexpected separate board position');
  return {
    present: present && app.root.isConnected,
    position,
    selected: probe?.selected !== null && probe !== undefined,
    held:
      present &&
      [...app.host.querySelectorAll('[data-piece-square]')].some((piece) =>
        piece.classList.contains(styles['lifted'] ?? '')
      ),
    interactive: probe?.interactive ?? false,
    soundEnabled: present && app.config().sound !== false,
    offers: app.moveDetails().map((move) => move.from + ' to ' + move.to),
  };
}
export const readPairModel = (w: BoardWorld) => {
  const pair = pairOf(w);
  return {
    chessboards: {
      first: readSeparateBoard(pair.first),
      second: readSeparateBoard(pair.second),
    },
    heardBoardSounds: pair.audio.played(),
  };
};
function evidence(app: PairApp) {
  const shared = {
    closed: app.closed(),
    attached: app.root.isConnected,
    hostAttached: app.host.isConnected,
    callbacks: app.moveDetails(),
    configuredSound: app.config().sound !== false,
  };
  if (app.closed()) return shared;
  return {
    ...shared,
    probe: app.probe(),
    pieces: app.view().pieces,
    layers: ['squares', 'arrows', 'shapes', 'feedback', 'pieces'].map((name) =>
      app.layer(name as Parameters<PairApp['layer']>[0])
    ),
    focus: app.host.contains(document.activeElement)
      ? document.activeElement?.getAttribute('data-square')
      : null,
    announcement: app.spoken(),
    markup: app.host.outerHTML,
  };
}
export const readPairFingerprint = (w: BoardWorld) => {
  const pair = pairOf(w);
  return JSON.stringify({
    first: evidence(pair.first),
    second: evidence(pair.second),
    played: pair.audio.played(),
  });
};
