// @model-profile: local
// Alice builds the board of one Sokoban draft. It starts 3 columns by 2 rows
// of floor, either with nothing on it or with the worker on A1, a crate on B1
// and a goal on C1. She changes its size to any number of columns and rows
// from 1 to 20; 21 is refused. A smaller board removes everything beyond its
// new edge and tells her which worker, crates and goals it removed; squares a
// bigger board adds are floor. She paints squares as a wall, floor, a goal or
// outside, and a wall or outside square removes the piece on it. She places
// the worker, which takes it from its earlier square, places crates, removes
// crates and erases squares back to floor with nothing on them. A piece placed
// on a wall or an outside square, or where a piece already stands, is refused,
// and so is removing a crate where none stands. The builder always lists what
// must be corrected and shows a preview of the board as built. Board edits can
// be undone and redone, a new board edit removes the redo choice, an edit that
// changes nothing adds nothing to undo, and reopening the app keeps the board
// with no undo or redo choices.
// Building needs no connection: the board behaves the same on a device with
// or without one; how a draft reaches the author's other devices is the shared
// draft rules'. The examples use squares A1 to C2 and the sizes 1, 2, 3, 20 and
// 21; building has no such limits.
module board_building {
  type Square = { column: int, row: int }
  type Board = { columns: int, rows: int, walls: Set[Square], goals: Set[Square],
    outside: Set[Square], worker: Set[Square], crates: Set[Square] }

  pure val KINDS = Set("wall", "floor", "goal", "outside")
  pure val SIZES = Set(1, 2, 3, 20, 21)
  pure val SQUARES = flatten(1.to(3).map(c => 1.to(2).map(r => { column: c, row: r })))
  pure val EMPTY_BOARD = { columns: 3, rows: 2, walls: Set(), goals: Set(), outside: Set(),
    worker: Set(), crates: Set() }
  pure val FINISHED_BOARD = { ...EMPTY_BOARD, worker: Set({ column: 1, row: 1 }),
    crates: Set({ column: 2, row: 1 }), goals: Set({ column: 3, row: 1 }) }

  var board: Board
  var preview: Board
  /// What the builder lists to correct: "missing worker", "no crates" and
  /// "crate and goal counts differ".
  var corrections: Set[str]
  /// What the last size change removed beyond the new edge: a "worker",
  /// "crate" or "goal" and its square.
  var removedBeyondEdge: Set[{ kind: str, square: Square }]
  var undoOffered: bool
  var redoOffered: bool
  var _earlier: List[Board]
  var _undone: List[Board]

  pure def _inside(b: Board, s: Square): bool =
    s.column >= 1 and s.column <= b.columns and s.row >= 1 and s.row <= b.rows
  pure def _standable(b: Board, s: Square): bool =
    _inside(b, s) and not(b.walls.contains(s)) and not(b.outside.contains(s))
  pure def _empty(b: Board, s: Square): bool =
    not(b.worker.contains(s)) and not(b.crates.contains(s))
  pure def _corrections(b: Board): Set[str] =
    (if (b.worker.size() == 0) Set("missing worker") else Set())
      .union(if (b.crates.size() == 0) Set("no crates") else Set())
      .union(if (b.crates.size() != b.goals.size()) Set("crate and goal counts differ") else Set())
  pure def _resized(b: Board, columns: int, rows: int): Board = {
    val sized = { ...b, columns: columns, rows: rows }
    { ...sized, walls: b.walls.filter(s => _inside(sized, s)),
      goals: b.goals.filter(s => _inside(sized, s)),
      outside: b.outside.filter(s => _inside(sized, s)),
      worker: b.worker.filter(s => _inside(sized, s)),
      crates: b.crates.filter(s => _inside(sized, s)) }
  }
  pure def _removed(b: Board, kept: Board): Set[{ kind: str, square: Square }] =
    b.worker.exclude(kept.worker).map(s => { kind: "worker", square: s })
      .union(b.crates.exclude(kept.crates).map(s => { kind: "crate", square: s }))
      .union(b.goals.exclude(kept.goals).map(s => { kind: "goal", square: s }))
  pure def _bare(b: Board, s: Square): Board =
    { ...b, walls: b.walls.exclude(Set(s)), goals: b.goals.exclude(Set(s)),
      outside: b.outside.exclude(Set(s)) }
  pure def _cleared(b: Board, s: Square): Board =
    { ...b, worker: b.worker.exclude(Set(s)), crates: b.crates.exclude(Set(s)) }

  action _show(b: Board, removed: Set[{ kind: str, square: Square }],
    earlier: List[Board], undone: List[Board]): bool = all {
    board' = b, preview' = b, corrections' = _corrections(b),
    removedBeyondEdge' = removed,
    undoOffered' = earlier.length() > 0, redoOffered' = undone.length() > 0,
    _earlier' = earlier, _undone' = undone,
  }

  /// A board edit that changes the board adds one edit to undo and removes the
  /// redo choice; one that changes nothing adds nothing.
  action _edit(b: Board, removed: Set[{ kind: str, square: Square }]): bool =
    if (b == board) _show(board, Set(), _earlier, _undone)
    else _show(b, removed, _earlier.append(board), List())

  action _refuse: bool = _show(board, Set(), _earlier, _undone)

  action init = {
    nondet start = Set(EMPTY_BOARD, FINISHED_BOARD).oneOf()
    all {
      board' = start, preview' = start, corrections' = _corrections(start),
      removedBeyondEdge' = Set(), undoOffered' = false, redoOffered' = false,
      _earlier' = List(), _undone' = List(),
    }
  }

  /// More than 20 columns or rows is refused.
  action changeBoardSize(columns: int, rows: int): bool = all {
    SIZES.contains(columns), SIZES.contains(rows),
    if (columns <= 20 and rows <= 20) {
      val kept = _resized(board, columns, rows)
      _edit(kept, _removed(board, kept))
    } else _refuse,
  }

  /// A wall or outside square removes the piece on it; floor and goals keep it.
  action paintSquare(square: Square, kind: str): bool = all {
    _inside(board, square), KINDS.contains(kind),
    val bare = _bare(board, square)
    val painted = if (kind == "wall") { ...bare, walls: bare.walls.union(Set(square)) }
      else if (kind == "goal") { ...bare, goals: bare.goals.union(Set(square)) }
      else if (kind == "outside") { ...bare, outside: bare.outside.union(Set(square)) }
      else bare
    _edit(if (kind == "wall" or kind == "outside") _cleared(painted, square) else painted, Set()),
  }

  /// The one worker goes to an empty floor or goal square.
  action placeWorker(square: Square): bool = all {
    _inside(board, square),
    if (_standable(board, square) and not(board.crates.contains(square)))
      _edit({ ...board, worker: Set(square) }, Set())
    else _refuse,
  }

  /// A crate goes to an empty floor or goal square.
  action placeCrate(square: Square): bool = all {
    _inside(board, square),
    if (_standable(board, square) and _empty(board, square))
      _edit({ ...board, crates: board.crates.union(Set(square)) }, Set())
    else _refuse,
  }

  action removeCrate(square: Square): bool = all {
    _inside(board, square),
    if (board.crates.contains(square))
      _edit({ ...board, crates: board.crates.exclude(Set(square)) }, Set())
    else _refuse,
  }

  action eraseSquare(square: Square): bool = all {
    _inside(board, square),
    _edit(_cleared(_bare(board, square), square), Set()),
  }

  /// Undo is offered only with an earlier board edit.
  action undoBoardEdit: bool = all {
    _earlier.length() > 0,
    _show(_earlier.nth(_earlier.length() - 1), Set(), _earlier.slice(0, _earlier.length() - 1),
      _undone.append(board)),
  }

  /// Redo is offered only while a new board edit has not replaced the undone one.
  action redoBoardEdit: bool = all {
    _undone.length() > 0,
    _show(_undone.nth(_undone.length() - 1), Set(), _earlier.append(board),
      _undone.slice(0, _undone.length() - 1)),
  }

  /// Reopening keeps the board, with or without something to correct, and offers no undo or redo.
  action reopenApp: bool = _show(board, Set(), List(), List())

  action step = {
    nondet columns = SIZES.oneOf()
    nondet rows = SIZES.oneOf()
    nondet square = SQUARES.oneOf()
    nondet kind = KINDS.oneOf()
    any { changeBoardSize(columns, rows), paintSquare(square, kind), placeWorker(square),
      placeCrate(square), removeCrate(square), eraseSquare(square),
      undoBoardEdit, redoBoardEdit, reopenApp }
  }

  /// The worker and crates stand only on floor or goals inside the board, one piece to a square.
  val invPiecesStandOnFloorOrGoals =
    board.worker.union(board.crates).forall(s => _standable(board, s)) and
      board.worker.intersect(board.crates) == Set()
  /// A board never has more than one worker.
  val invOneWorkerAtMost = board.worker.size() <= 1
  /// A board has 1 to 20 columns and rows, and nothing lies beyond its edge.
  val invEverythingIsOnTheBoard = board.columns >= 1 and board.columns <= 20 and
    board.rows >= 1 and board.rows <= 20 and
    board.walls.union(board.goals).union(board.outside).forall(s => _inside(board, s))
  /// A square is one kind only: a wall, a goal, outside, or else floor.
  val invEachSquareHasOneKind = board.walls.intersect(board.goals) == Set() and
    board.walls.intersect(board.outside) == Set() and board.goals.intersect(board.outside) == Set()
  /// What the builder lists to correct always describes the board as it is.
  val invCorrectionsDescribeTheBoard = corrections == _corrections(board)
  /// The preview always shows the board as built.
  val invPreviewShowsTheBoard = preview == board
  /// What a smaller board reports removed lay beyond its new edge.
  val invRemovalsLayBeyondTheEdge = removedBeyondEdge.forall(r => not(_inside(board, r.square)))
  /// Undo is offered exactly when there is an earlier board edit.
  val invUndoHasEarlierEdit = undoOffered == (_earlier.length() > 0)
  /// Redo is offered exactly when an undone board edit has not been replaced.
  val invRedoHasUndoneEdit = redoOffered == (_undone.length() > 0)
}
