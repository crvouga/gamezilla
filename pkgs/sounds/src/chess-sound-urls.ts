// Vite / browser asset URLs.
export const chessSoundUrls = {
  move: new URL('../assets/gameplay/chess/move-2.mp3', import.meta.url).href,
  capture: new URL('../assets/gameplay/chess/capture-2.mp3', import.meta.url)
    .href,
  check: new URL('../assets/gameplay/chess/check-2.mp3', import.meta.url).href,
  castle: new URL('../assets/gameplay/chess/castling-2.mp3', import.meta.url)
    .href,
  promote: new URL('../assets/gameplay/chess/ui_unlock.mp3', import.meta.url)
    .href,
  illegal: new URL(
    '../assets/gameplay/chess/navigation-cancel.mp3',
    import.meta.url
  ).href,
  gameEnd: new URL('../assets/gameplay/chess/game-over.mp3', import.meta.url)
    .href,
  puzzleCheckmate: new URL(
    '../assets/gameplay/chess/game-over-checkmate.mp3',
    import.meta.url
  ).href,
  puzzleEloTick: new URL(
    '../assets/gameplay/chess/navigation_forward-selection-minimal.mp3',
    import.meta.url
  ).href,
  puzzleCorrectMove: new URL(
    '../assets/gameplay/chess/move-1.mp3',
    import.meta.url
  ).href,
  puzzleEloCompleteLoss: new URL(
    '../assets/gameplay/chess/game-over-stalemate.mp3',
    import.meta.url
  ).href,
} as const;

export type ChessSoundUrlId = keyof typeof chessSoundUrls;
