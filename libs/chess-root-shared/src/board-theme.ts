/**
 * The product board: cool blue-gray squares that sit quietly beside the
 * app's neutral surfaces, with the app's blue for the last move and the
 * selected piece. Every product board passes it as `theme`, so a new board
 * matches without picking colors.
 *
 * Board paint is a fixed surface, not a scheme token: the squares read the
 * same on a light or dark app, like a real board on any table.
 */
export const BOARD_THEME = {
  lightSquare: '#DEE3E6',
  darkSquare: '#8CA2AD',
  border: '#6F8794',
  lastMove: 'rgba(29, 155, 240, 0.38)',
  selected: 'rgba(29, 155, 240, 0.50)',
} as const;
