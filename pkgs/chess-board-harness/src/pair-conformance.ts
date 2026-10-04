import { auditTree } from '@pkgs/a11y-shared/audit';
import { defineProperty } from '@pkgs/harness-shared/define-property';
import { Chess } from 'chess.js';
import type { BoardWorld } from './board-world';
import { currentPair } from './pair-world';
import type { PairApp } from './pair-world';

function checkBoard(w: BoardWorld, app: PairApp) {
  if (app.closed()) {
    if (app.root.isConnected || app.host.isConnected)
      throw new Error('Closed separate board remains attached');
    return;
  }
  const expected = new Chess(app.probe().fen)
    .board()
    .flatMap((rank) =>
      rank.flatMap((piece) =>
        piece === null ? [] : [piece.color + piece.type + '@' + piece.square]
      )
    )
    .sort();
  const actual = app.view().pieces;
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error('Separate board paint disagrees with canonical position');
  if (app.host.querySelectorAll('[data-square]').length !== 64)
    throw new Error('Separate board does not expose all 64 squares');
  const markup = app.host.outerHTML;
  if (!w.auditedMarkups.has(markup)) {
    const findings = auditTree(app.host);
    if (findings.length > 0)
      throw new Error(
        'Separate board accessibility: ' + JSON.stringify(findings)
      );
    w.auditedMarkups.add(markup);
  }
}
export const pairConformance = defineProperty({
  name: 'separate-board-conformance',
  check(w: BoardWorld) {
    const pair = currentPair(w);
    if (pair === undefined) return;
    checkBoard(w, pair.first);
    checkBoard(w, pair.second);
  },
});
