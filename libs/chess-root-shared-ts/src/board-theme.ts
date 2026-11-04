/**
 * The product board: cream and walnut squares (the design tokens'
 * `boardLight` / `boardDark`), with the tokens' gold `boardHighlight` for the
 * last move and the selected piece. Every product board passes it as
 * `theme`, so a new board matches without picking colors.
 *
 * Board paint is a fixed surface, not a scheme token: the squares read the
 * same on a light or dark app, like a real board on any table.
 */
export const BOARD_THEME = {
  lightSquare: '#F0D9B5',
  darkSquare: '#B58863',
  border: '#8B6A4E',
  lastMove: 'rgba(232, 197, 71, 0.55)',
  selected: 'rgba(232, 197, 71, 0.75)',
} as const;
