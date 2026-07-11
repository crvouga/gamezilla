export const chessSoundSources = {
  move: require('../assets/gameplay/chess/move-2.wav'),
  capture: require('../assets/gameplay/chess/capture-2.wav'),
  check: require('../assets/gameplay/chess/check-2.wav'),
  castle: require('../assets/gameplay/chess/castling-2.wav'),
  promote: require('../assets/gameplay/chess/ui_unlock.wav'),
  illegal: require('../assets/gameplay/chess/navigation-cancel.wav'),
  gameEnd: require('../assets/gameplay/chess/game-over.wav'),
  puzzleCheckmate: require('../assets/gameplay/chess/game-over-checkmate.wav'),
  puzzleEloTick: require('../assets/gameplay/chess/navigation_forward-selection-minimal.wav'),
  puzzleCorrectMove: require('../assets/gameplay/chess/move-1.wav'),
  puzzleEloCompleteLoss: require('../assets/gameplay/chess/game-over-stalemate.wav'),
} as const;

export type ChessSoundSourceId = keyof typeof chessSoundSources;
