// @model-profile: local
// Alice can select, hold and move pieces while her activity changes the
// position and board settings. The chessboard behaves identically offline.
// Positions stand for a capture opportunity, its result, and a replacement;
// chess legality belongs to chess, rather than to this interaction model.
module board_lifecycle {
  type _Board = {position: int, selected: bool, dragging: bool,
    interactive: bool, soundEnabled: bool, reducedMotion: bool,
    orientation: str, transition: bool}
  var board: _Board
  action init = board' = {position: 0, selected: false, dragging: false,
    interactive: true, soundEnabled: true, reducedMotion: false,
    orientation: "white", transition: false}

  /// Alice chooses a movable piece, or puts down her existing selection.
  action selectPiece = all {
    not(board.dragging),
    board' = { ...board, selected: if (board.interactive and board.position == 0) not(board.selected) else false },
  }
  /// Alice holds a piece before deciding where to put it.
  action beginDrag = all {
    board.interactive, board.position == 0, not(board.dragging),
    board' = { ...board, selected: false, dragging: true },
  }
  /// Alice abandons the held piece without making a move.
  action cancelDrag = board' = { ...board, dragging: false }
  /// Alice's legal capture replaces the position and starts its arrival.
  action movePiece = all {
    board.interactive, board.position == 0,
    board' = { ...board, position: 1, selected: false, dragging: false, transition: not(board.reducedMotion) },
  }
  /// A new activity replaces the position, abandoning every old gesture.
  action replacePosition(target: int): bool = all {
    Set(0, 2).contains(target),
    board' = if (target == board.position) board
      else { ...board, position: target, selected: false, dragging: false, transition: false },
  }
  /// The activity's choices take effect at once, including during a move.
  action configureBoard(canMove: bool, sound: bool, reduced: bool): bool = board' = {
    ...board, interactive: canMove, soundEnabled: sound, reducedMotion: reduced,
    selected: board.selected and canMove, dragging: board.dragging and canMove,
    transition: board.transition and not(reduced),
  }
  /// Turning the board puts a held piece back, with the same position.
  action flipBoard = board' = { ...board, dragging: false, transition: false,
    orientation: if (board.orientation == "white") "black" else "white" }
  /// Changing available space keeps selection and abandons a held piece.
  action resizeBoard = board' = { ...board, dragging: false }
  /// A moving piece finishes at the current position, never an old position.
  action finishAnimation = board' = { ...board, transition: false }

  action step = {
    nondet target = Set(0, 2).oneOf()
    nondet canMove = Set(false, true).oneOf()
    nondet sound = Set(false, true).oneOf()
    nondet reduced = Set(false, true).oneOf()
    any { selectPiece, beginDrag, cancelDrag, movePiece, replacePosition(target),
      configureBoard(canMove, sound, reduced), flipBoard, resizeBoard, finishAnimation }
  }
  /// Every piece belongs to the latest position, including after interruptions.
  val invValidPosition = Set(0, 1, 2).contains(board.position)
  /// Disabling input puts every piece down and clears selection.
  val invDisabled = not(board.interactive) implies not(board.selected or board.dragging)
  /// Reduced motion never waits for a moving piece to finish.
  val invReducedMotion = board.reducedMotion implies not(board.transition)
  /// A held piece cannot also be selected.
  val invOneGesture = not(board.selected and board.dragging)
  /// Orientation and sound are choices of the activity.
  val invSettings = Set("white", "black").contains(board.orientation) and
    Set(false, true).contains(board.soundEnabled)
}
