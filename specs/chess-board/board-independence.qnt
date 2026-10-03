// @model-profile: local
// Alice's first and second chessboards each own their pieces, input, sound,
// selected or held piece, and their activity's received moves. Heard sounds
// are one shared audible record, with no invented attribution to a board. Each has the
// prepared opening pawn move e2 to e4 and an unrelated replacement position.
// A pointer holds at most one piece across these examples; another pointer
// gesture begins after it is released. Activity settings can change while held.
// One board may close while the other remains open to observe independence.
// Closing the last board is covered by the lifecycle model, outside this bound.
// Chess legality is already decided. The behavior is identical offline.
module board_independence {
  type SeparateBoard = {present: bool, position: str, selected: bool, held: bool,
    interactive: bool, soundEnabled: bool, offers: List[str]}
  type BoardPair = {first: SeparateBoard, second: SeparateBoard}
  var chessboards: BoardPair
  var heardBoardSounds: List[str]
  pure val _OPEN: SeparateBoard = {present: true, position: "opening", selected: false,
    held: false, interactive: true, soundEnabled: true, offers: []}
  def _get(name: str): SeparateBoard = if (name == "first") chessboards.first else chessboards.second
  def _with(name: str, changed: SeparateBoard): BoardPair =
    if (name == "first") { ...chessboards, first: changed } else { ...chessboards, second: changed }
  def _addressed(name: str): bool = Set("first", "second").contains(name) and _get(name).present
  val _handsFree = not(chessboards.first.held or chessboards.second.held)
  action init = all {chessboards' = {first: _OPEN, second: _OPEN}, heardBoardSounds' = []}

  /// Alice chooses a source without changing the other board's selection.
  action selectSeparatePiece(name: str): bool = all {
    _addressed(name), _handsFree, _get(name).position == "opening",
    chessboards' = _with(name, { ..._get(name), selected: _get(name).interactive and not(_get(name).selected) }),
    heardBoardSounds' = heardBoardSounds,
  }
  /// Alice holds a piece on one board while the other keeps its own choice.
  action beginSeparateDrag(name: str): bool = all {
    _addressed(name), _handsFree, _get(name).position == "opening", _get(name).interactive,
    chessboards' = _with(name, { ..._get(name), selected: false, held: true }),
    heardBoardSounds' = heardBoardSounds,
  }
  /// Alice releases only the addressed held piece.
  action cancelSeparateDrag(name: str): bool = all {
    _addressed(name), _get(name).held,
    chessboards' = _with(name, { ..._get(name), held: false }),
    heardBoardSounds' = heardBoardSounds,
  }
  /// One board offers and sounds its own legal move according to its choices.
  action moveSeparatePiece(name: str): bool = all {
    _addressed(name), _handsFree, _get(name).position == "opening",
    {
      val s = _get(name)
      all {
        chessboards' = _with(name, if (s.interactive)
          { ...s, position: "moved", selected: false, held: false,
            offers: ["e2 to e4"] } else s),
        heardBoardSounds' = if (s.interactive and s.soundEnabled)
          heardBoardSounds.append("move") else heardBoardSounds,
      }
    },
  }
  /// The activity's input choice clears only that board's unfinished gesture.
  action configureSeparateInput(name: str, canMove: bool): bool = all {
    _addressed(name),
    chessboards' = _with(name, { ..._get(name), interactive: canMove,
      selected: _get(name).selected and canMove, held: _get(name).held and canMove }),
    heardBoardSounds' = heardBoardSounds,
  }
  /// The activity's sound choice affects only its own board and never replays a sound.
  action configureSeparateSound(name: str, sound: bool): bool = all {
    _addressed(name), chessboards' = _with(name, { ..._get(name), soundEnabled: sound }),
    heardBoardSounds' = heardBoardSounds,
  }
  /// The activity supplies its own unrelated position, clearing only its own gesture.
  action replaceSeparatePosition(name: str): bool = all {
    _addressed(name), chessboards' = _with(name, { ..._get(name),
      position: "replacement", selected: false, held: false }),
    heardBoardSounds' = heardBoardSounds,
  }
  /// Closing one board leaves the other board and both activity histories intact.
  action closeSeparateBoard(name: str): bool = all {
    _addressed(name), if (name == "first") chessboards.second.present else chessboards.first.present,
    chessboards' = _with(name, { ..._get(name), present: false, position: "absent",
      selected: false, held: false, interactive: false, soundEnabled: false }),
    heardBoardSounds' = heardBoardSounds,
  }
  action step = {
    nondet name = Set("first", "second").oneOf()
    nondet canMove = Set(false, true).oneOf()
    nondet sound = Set(false, true).oneOf()
    any {selectSeparatePiece(name), beginSeparateDrag(name), cancelSeparateDrag(name),
      moveSeparatePiece(name), configureSeparateInput(name, canMove), configureSeparateSound(name, sound),
      replaceSeparatePosition(name), closeSeparateBoard(name)}
  }
  /// A held piece has no simultaneous selection, and disabled boards have neither.
  val invSeparateGestures = Set(chessboards.first, chessboards.second).forall(s =>
    not(s.selected and s.held) and (not(s.interactive) implies not(s.selected or s.held)))
  /// Every board retains its own prepared position or has no position after closing.
  val invSeparatePositions = Set(chessboards.first, chessboards.second).forall(s =>
    if (s.present) Set("opening", "moved", "replacement").contains(s.position)
    else s.position == "absent" and not(s.selected or s.held))
  /// Each prepared local move is received once by its own activity; the shared
  /// audible record has at most one sound for each completed move.
  val invSeparateOffers = Set(chessboards.first, chessboards.second).forall(s =>
    s.offers == [] or s.offers == ["e2 to e4"]) and
    heardBoardSounds.length() <= chessboards.first.offers.length() + chessboards.second.offers.length() and
    heardBoardSounds.indices().forall(i => heardBoardSounds.nth(i) == "move")
}
