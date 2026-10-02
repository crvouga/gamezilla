// @model-profile: local
// Alice can select, hold and move pieces while her activity changes its
// position and choices. Displayed pieces always belong to the newest position.
// Positions stand for a capture opportunity, its capture result, an unrelated
// replacement, Black's legal reply to that capture, and the normal opening.
// Their chess legality is already decided. This behavior is identical offline.
// The capture and its immediate knight reply may arrive together while both
// pieces still belong to the current position. These requests precede any
// completed arrival; finishing current motion settles both prepared pieces.
// Those two current arrivals and the most recently abandoned arrival bound this model.
// The earlier completion is a retained, real arrival belonging to its own piece;
// completing it cannot finish a newer arrival, even at the same position.
// A closed board has no displayed pieces or position. Starting with an unusable
// position opens normal chess. An unusable supply to an open board is ignored.
module board_lifecycle {
  type LifecycleBoard = {present: bool, position: int, displayedPosition: int,
    selected: bool, dragging: bool, interactive: bool, soundEnabled: bool,
    reducedMotion: bool, orientation: str, transition: bool,
    captureRemnant: bool, visible: bool}
  var board: LifecycleBoard
  // Bookkeeping: availability of the actual earlier arrival's retained completion.
  // Its ownership differs from the current arrival, independently of position.
  var _earlierCompletion: bool
  pure def _open(position: int): LifecycleBoard = {present: true,
    position: position, displayedPosition: position, selected: false, dragging: false,
    interactive: true, soundEnabled: true, reducedMotion: false,
    orientation: "white", transition: false, captureRemnant: false, visible: true}
  pure def _settled(s: LifecycleBoard): LifecycleBoard = {
    ...s, displayedPosition: s.position, transition: false, captureRemnant: false,
  }
  pure def _canArrive(s: LifecycleBoard): bool = s.visible and not(s.reducedMotion)
  action init = all {board' = _open(0), _earlierCompletion' = false}

  /// Alice chooses the prepared movable piece, or puts down her selection.
  action selectPiece = all {
    board.present, board.visible, board.position == 0, not(board.dragging),
    board' = { ...board, selected: board.interactive and not(board.selected) },
    _earlierCompletion' = _earlierCompletion,
  }
  /// Alice holds the prepared piece before deciding where to put it.
  action beginDrag = all {
    board.present, board.interactive, board.visible, board.position == 0, not(board.dragging),
    board' = { ...board, selected: false, dragging: true },
    _earlierCompletion' = _earlierCompletion,
  }
  /// Alice abandons the held piece without making a move.
  action cancelDrag = all {
    board.present, board.visible, board' = { ...board, dragging: false },
    _earlierCompletion' = _earlierCompletion,
  }
  /// Switching away returns a held piece without changing the position.
  action switchAway = all {
    board.present, board' = { ...board, dragging: false },
    _earlierCompletion' = _earlierCompletion,
  }
  /// Alice's legal capture replaces the position and starts its current arrival.
  action movePiece = all {
    board.present, board.visible, board.interactive, board.position == 0,
    board' = { ...board, position: 1, displayedPosition: 1, selected: false,
      dragging: false, transition: _canArrive(board), captureRemnant: _canArrive(board) },
    _earlierCompletion' = _earlierCompletion,
  }
  /// Black's prepared reply owns the displayed position even during the capture.
  action receiveReply = all {
    board.present, board.position == 1,
    board' = { ...board, position: 3, displayedPosition: 3, selected: false,
      dragging: false, transition: _canArrive(board), captureRemnant: board.captureRemnant },
    _earlierCompletion' = _earlierCompletion,
  }
  /// Equivalent supplied positions preserve the current arrival and remnant.
  /// A different activity position abandons that arrival and every old gesture.
  action replacePosition(target: int): bool = all {
    board.present, Set(0, 2, 4).contains(target) or target == board.position,
    board' = if (target == board.position) board
      else { ..._settled(board), position: target, displayedPosition: target,
        selected: false, dragging: false },
    _earlierCompletion' = (_earlierCompletion or (target != board.position and board.transition)),
  }
  /// An unusable supplied position preserves the last good displayed position.
  action supplyUnusablePosition = all {
    board.present, board' = board, _earlierCompletion' = _earlierCompletion,
  }
  /// The activity's choices take effect at once, including during a move.
  action configureBoard(canMove: bool, sound: bool, reduced: bool): bool = all {
    board.present,
    board' = { ...board, interactive: canMove, soundEnabled: sound, reducedMotion: reduced,
      selected: board.selected and canMove, dragging: board.dragging and canMove,
      transition: board.transition and not(reduced), captureRemnant: board.captureRemnant and not(reduced) },
    _earlierCompletion' = (_earlierCompletion or (board.transition and reduced)),
  }
  /// Turning puts a held piece back and settles the same position.
  action flipBoard = all {
    board.present, board' = { ..._settled(board), dragging: false,
      orientation: if (board.orientation == "white") "black" else "white" },
    _earlierCompletion' = (_earlierCompletion or board.transition),
  }
  /// Changing available space keeps selection and abandons a held piece.
  action resizeBoard = all {
    board.present, board' = { ...board, dragging: false },
    _earlierCompletion' = _earlierCompletion,
  }
  /// The current arrival finishes at the newest displayed position.
  action finishAnimation = all {
    board.present, board' = _settled(board), _earlierCompletion' = _earlierCompletion,
  }
  /// World event: a real abandoned arrival finishes once. It cannot restore its
  /// pieces or finish a newer arrival, including a newer capture at the same square.
  action finishEarlierAnimation = all {
    _earlierCompletion, board' = board, _earlierCompletion' = false,
  }
  /// Hiding settles motion; showing never resumes an obsolete arrival.
  action setVisibility(visible: bool): bool = all {
    board.present, board' = { ...board, visible: visible,
      transition: board.transition and visible, captureRemnant: board.captureRemnant and visible,
      dragging: board.dragging and visible },
    _earlierCompletion' = (_earlierCompletion or (board.transition and not(visible))),
  }
  /// Closing removes the board and prevents any abandoned arrival appearing again.
  action closeBoard = all {
    board.present, board' = {present: false, position: -1, displayedPosition: -1,
      selected: false, dragging: false, interactive: false, soundEnabled: false,
      reducedMotion: false, orientation: "none", transition: false,
      captureRemnant: false, visible: false},
    _earlierCompletion' = (_earlierCompletion or board.transition),
  }
  /// An activity without a board starts normal chess when its initial position is unusable.
  action startBoardWithUnusablePosition = all {
    not(board.present), board' = _open(4), _earlierCompletion' = _earlierCompletion,
  }

  action step = {
    nondet target = Set(0, 1, 2, 3, 4).oneOf()
    nondet canMove = Set(false, true).oneOf()
    nondet sound = Set(false, true).oneOf()
    nondet reduced = Set(false, true).oneOf()
    nondet visible = Set(false, true).oneOf()
    any { selectPiece, beginDrag, cancelDrag, switchAway, movePiece, receiveReply,
      replacePosition(target), supplyUnusablePosition, configureBoard(canMove, sound, reduced),
      flipBoard, resizeBoard, finishAnimation, finishEarlierAnimation,
      setVisibility(visible), closeBoard, startBoardWithUnusablePosition }
  }
  /// The latest position owns displayed pieces, even when older motion finishes.
  val invDisplayedPosition = board.displayedPosition == board.position and
    (if (board.present) Set(0, 1, 2, 3, 4).contains(board.position) else board.position == -1)
  /// One capture remnant belongs only to its valid arriving pawn, including
  /// during an immediate reply that preserves that pawn in the latest position.
  val invCaptureRemnant = (board.captureRemnant implies
    (board.transition and Set(1, 3).contains(board.position))) and
    ((board.transition and board.position == 1) implies board.captureRemnant)
  /// Disabling input puts every piece down and clears selection.
  val invDisabled = not(board.interactive) implies not(board.selected or board.dragging)
  /// Reduced motion never waits for a moving piece or captured remnant.
  val invReducedMotion = board.reducedMotion implies not(board.transition or board.captureRemnant)
  /// Hidden activities retain a settled position without a held piece.
  val invHidden = not(board.visible) implies not(board.transition or board.captureRemnant or board.dragging)
  /// A held piece cannot also be selected.
  val invOneGesture = not(board.selected and board.dragging)
  /// A closed board has no pieces, gestures or current arrival to observe.
  val invClosed = not(board.present) implies
    (board.displayedPosition == -1 and not(board.selected or board.dragging or board.transition or board.captureRemnant))
  /// Orientation remains a choice of the activity while its board is open.
  val invSettings = if (board.present) Set("white", "black").contains(board.orientation)
    else board.orientation == "none"
  temporal _timePasses = finishAnimation.weakFair(board)
  /// Every current arrival eventually settles at the latest displayed position,
  /// with no captured remnant, when time continues to pass.
  temporal liveAnimationFinishes = _timePasses.implies(always(board.transition implies
    eventually(not(board.transition) and not(board.captureRemnant) and board.displayedPosition == board.position)))
}
