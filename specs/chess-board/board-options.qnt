// @model-profile: local
// Alice's activity chooses coordinates, destination marks, last move marks,
// colors and width. Markings and colors preserve pieces and unfinished choices.
// Broad space has room to move; narrow space is a preview. A fixed width wins
// over available space. Broad available space and a chosen broad width are
// distinct supported widths. A changed width abandons a held piece; a preview also
// abandons selection and promotion, and returning to enough room starts fresh.
// The activity can disable input at any width. Prepared positions represent
// the opening pawn move, a pawn ready to promote, and an unrelated replacement.
// Their chess legality is already decided. This behavior is identical offline.
module board_options {
  type OptionsBoard = {position: str, selected: bool, held: bool, pendingPromotion: bool,
    interactive: bool, roomToMove: bool, availableSpace: str, fixedWidth: bool,
    chosenSpace: str, width: str, coordinates: bool, legalMarks: bool,
    lastMoveMarks: bool, colors: str}
  var optionsBoard: OptionsBoard
  pure def _width(available: str, fixed: bool, chosen: str): str =
    if (fixed) (if (chosen == "broad") "chosen broad" else "chosen narrow") else available
  pure def _room(available: str, fixed: bool, chosen: str): bool =
    (if (fixed) chosen else available) == "broad"
  pure def _sized(s: OptionsBoard, available: str, fixed: bool, chosen: str): OptionsBoard = {
    val room = _room(available, fixed, chosen)
    val width = _width(available, fixed, chosen)
    { ...s, availableSpace: available, fixedWidth: fixed, chosenSpace: if (fixed) chosen else "none",
      width: width, roomToMove: room, selected: s.selected and room,
      held: s.held and room and width == s.width,
      pendingPromotion: s.pendingPromotion and room }
  }
  pure def _canMove(s: OptionsBoard): bool = s.interactive and s.roomToMove
  action init = optionsBoard' = {position: "opening", selected: false, held: false,
    pendingPromotion: false, interactive: true, roomToMove: true,
    availableSpace: "broad", fixedWidth: false, chosenSpace: "none", width: "broad",
    coordinates: true, legalMarks: true, lastMoveMarks: true, colors: "brown and cream"}

  /// Alice chooses the prepared piece only when the board offers moves.
  action selectOptionsPiece = all {
    optionsBoard.position == "opening", not(optionsBoard.held),
    optionsBoard' = if (_canMove(optionsBoard))
      { ...optionsBoard, selected: not(optionsBoard.selected) } else optionsBoard,
  }
  /// Alice holds the prepared piece only when the board offers moves.
  action beginOptionsDrag = all {
    optionsBoard.position == "opening", not(optionsBoard.held),
    optionsBoard' = if (_canMove(optionsBoard))
      { ...optionsBoard, selected: false, held: true } else optionsBoard,
  }
  /// The prepared opening move completes only while input is permitted.
  action moveOptionsPiece = all {
    optionsBoard.position == "opening",
    optionsBoard' = if (_canMove(optionsBoard))
      { ...optionsBoard, position: "moved", selected: false, held: false }
      else optionsBoard,
  }
  /// A prepared last-rank move asks for a choice while leaving its pawn at source.
  action requestOptionsPromotion = all {
    optionsBoard.position == "promotion", not(optionsBoard.pendingPromotion),
    optionsBoard' = if (_canMove(optionsBoard))
      { ...optionsBoard, selected: false, held: false, pendingPromotion: true }
      else optionsBoard,
  }
  /// Changed available space respects a fixed width and cancels input in a preview.
  action resizeAvailableSpace(available: str): bool = all {
    Set("broad", "narrow").contains(available),
    optionsBoard' = _sized(optionsBoard, available, optionsBoard.fixedWidth, optionsBoard.chosenSpace),
  }
  /// A chosen width wins over available space; removing it restores that space.
  action configureFixedWidth(fixed: bool, chosen: str): bool = all {
    Set("broad", "narrow").contains(chosen),
    optionsBoard' = _sized(optionsBoard, optionsBoard.availableSpace, fixed, chosen),
  }
  /// The activity may disable input even when there is room to move.
  action configureOptionsInput(canMove: bool): bool = optionsBoard' = {
    ...optionsBoard, interactive: canMove, selected: optionsBoard.selected and canMove,
    held: optionsBoard.held and canMove, pendingPromotion: optionsBoard.pendingPromotion and canMove,
  }
  /// Coordinate visibility preserves position and unfinished choices.
  action configureCoordinates(show: bool): bool = optionsBoard' = { ...optionsBoard, coordinates: show }
  /// Legal marking visibility preserves selection and the piece's legal meaning.
  action configureLegalMarks(show: bool): bool = optionsBoard' = { ...optionsBoard, legalMarks: show }
  /// Last move marking visibility preserves the completed position.
  action configureLastMoveMarks(show: bool): bool = optionsBoard' = { ...optionsBoard, lastMoveMarks: show }
  /// Chosen board colors preserve position and unfinished choices.
  action configureBoardColors(colors: str): bool = all {
    Set("brown and cream", "green and cream").contains(colors),
    optionsBoard' = { ...optionsBoard, colors: colors },
  }
  /// A different supplied position abandons its selection, holding and promotion.
  action replaceOptionsPosition(target: str): bool = all {
    Set("opening", "promotion", "replacement").contains(target),
    optionsBoard' = if (target == optionsBoard.position) optionsBoard else {
      ...optionsBoard, position: target, selected: false, held: false, pendingPromotion: false },
  }
  action step = {
    nondet available = Set("broad", "narrow").oneOf()
    nondet fixed = Set(false, true).oneOf()
    nondet chosen = Set("broad", "narrow").oneOf()
    nondet canMove = Set(false, true).oneOf()
    nondet show = Set(false, true).oneOf()
    nondet colors = Set("brown and cream", "green and cream").oneOf()
    nondet target = Set("opening", "promotion", "replacement").oneOf()
    any { selectOptionsPiece, beginOptionsDrag, moveOptionsPiece, requestOptionsPromotion,
      resizeAvailableSpace(available), configureFixedWidth(fixed, chosen), configureOptionsInput(canMove),
      configureCoordinates(show), configureLegalMarks(show), configureLastMoveMarks(show),
      configureBoardColors(colors), replaceOptionsPosition(target) }
  }
  /// Preview and disabled boards retain no unfinished input.
  val invOptionsAuthority = not(_canMove(optionsBoard)) implies
    not(optionsBoard.selected or optionsBoard.held or optionsBoard.pendingPromotion)
  /// One unfinished choice belongs to its prepared source position.
  val invOptionsGesture = not(optionsBoard.selected and optionsBoard.held) and
    (optionsBoard.pendingPromotion implies
      (optionsBoard.position == "promotion" and not(optionsBoard.selected or optionsBoard.held))) and
    ((optionsBoard.selected or optionsBoard.held) implies
      Set("opening", "promotion").contains(optionsBoard.position))
  /// The fixed width owns both the footprint and whether that width permits moves.
  val invOptionsWidth = Set("broad", "narrow").contains(optionsBoard.availableSpace) and
    ((optionsBoard.fixedWidth and Set("broad", "narrow").contains(optionsBoard.chosenSpace)) or
      (not(optionsBoard.fixedWidth) and optionsBoard.chosenSpace == "none")) and
    optionsBoard.width == _width(optionsBoard.availableSpace, optionsBoard.fixedWidth, optionsBoard.chosenSpace) and
    optionsBoard.roomToMove == _room(optionsBoard.availableSpace, optionsBoard.fixedWidth, optionsBoard.chosenSpace)
  /// Appearance changes retain a prepared position and the chosen colors.
  val invOptionsPosition = Set("opening", "promotion", "moved", "replacement").contains(optionsBoard.position) and
    Set("brown and cream", "green and cream").contains(optionsBoard.colors)
}
