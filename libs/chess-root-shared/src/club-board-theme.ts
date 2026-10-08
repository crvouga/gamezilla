/**
 * The board in the app's club-room palette: sage baize dark squares, ivory
 * light squares, and brass for the last move and the selected piece, the
 * same brass that marks every chosen thing in the app. Every product board
 * passes it as `theme`, so a new board matches without picking colors.
 *
 * Board paint is a fixed surface, not a scheme token: the squares read the
 * same on a light or dark app, like a real board on any table.
 */
export const CLUB_BOARD_THEME = {
  lightSquare: '#E9E7D8',
  darkSquare: '#779A82',
  border: '#3E5A4C',
  lastMove: 'rgba(226, 177, 60, 0.55)',
  selected: 'rgba(226, 177, 60, 0.65)',
} as const;
