export const chessSoundSources = {
  move: require('../assets/gameplay/chess/move-2.mp3'),
  capture: require('../assets/gameplay/chess/capture-2.mp3'),
  check: require('../assets/gameplay/chess/check-2.mp3'),
  castle: require('../assets/gameplay/chess/castling-2.mp3'),
  promote: require('../assets/gameplay/chess/ui_unlock.mp3'),
  illegal: require('../assets/gameplay/chess/navigation-cancel.mp3'),
  gameEnd: require('../assets/gameplay/chess/game-over.mp3'),
  puzzleCheckmate: require('../assets/gameplay/chess/game-over-checkmate.mp3'),
  puzzleEloTick: require('../assets/gameplay/chess/navigation_forward-selection-minimal.mp3'),
  puzzleCorrectMove: require('../assets/gameplay/chess/move-1.mp3'),
  puzzleEloCompleteLoss: require('../assets/gameplay/chess/game-over-stalemate.mp3'),
} as const;

export type ChessSoundSourceId = keyof typeof chessSoundSources;
