// @model-profile: local
// Bob plays one Sokoban puzzle on a board of one row, A1 to G1: A1 is a wall,
// B1, C1 and D1 are floor, E1 and F1 are goals and G1 is outside. Above and
// below the row is the board's edge. In the first starting position the worker
// stands on B1 with crates on C1 and F1; in the second both crates already
// stand on the goals E1 and F1.
// Bob moves the worker up, down, left or right. A move steps onto an empty
// floor or goal square, or pushes the one crate in front of the worker one
// square further when the square beyond is empty floor or an empty goal. A
// wall, an outside square, the board's edge, a crate against a wall and two
// crates in a row refuse the move, which changes nothing. Each move counts
// one move and each push also one push. Undo and redo restore a position with
// its moves and pushes, and a new move removes the redo choice. Restart
// returns to the starting position with no moves and no pushes. The puzzle is
// complete whenever every crate stands on a goal, at once with no moves when
// the crates start there, and it counts as completed only once.
// Play needs no connection: every rule here works the same on a device with or
// without one. The examples stop at eight moves; play itself has no such limit.
module sokoban_play {
  type Position = { worker: int, crates: Set[int], moves: int, pushes: int }

  pure val SQUARES = 0.to(6)
  pure val WALLS = Set(0)
  pure val OUTSIDE = Set(6)
  pure val GOALS = Set(4, 5)
  pure val DIRECTIONS = Set("up", "down", "left", "right")
  pure val FIRST_START = { worker: 1, crates: Set(2, 5), moves: 0, pushes: 0 }
  pure val SECOND_START = { worker: 1, crates: Set(4, 5), moves: 0, pushes: 0 }
  pure val MOVE_BOUND = 8

  /// The square the worker stands on, 0 for A1 to 6 for G1.
  var worker: int
  /// The squares the crates stand on.
  var crates: Set[int]
  var moves: int
  var pushes: int
  /// Whether every crate stands on a goal.
  var complete: bool
  /// How many times this puzzle has counted as completed: never more than once.
  var completions: int
  var _start: Position
  var _earlier: List[Position]
  var _undone: List[Position]

  val _position = { worker: worker, crates: crates, moves: moves, pushes: pushes }

  pure def _standable(square: int): bool =
    SQUARES.contains(square) and not(WALLS.contains(square)) and not(OUTSIDE.contains(square))

  /// The position after one move, or the same position when the move is refused.
  pure def _after(p: Position, direction: str): Position =
    if (direction == "up" or direction == "down") p
    else {
      val stride = if (direction == "right") 1 else -1
      val ahead = p.worker + stride
      val beyond = ahead + stride
      if (not(_standable(ahead))) p
      else if (not(p.crates.contains(ahead)))
        { ...p, worker: ahead, moves: p.moves + 1 }
      else if (_standable(beyond) and not(p.crates.contains(beyond)))
        { worker: ahead, crates: p.crates.exclude(Set(ahead)).union(Set(beyond)),
          moves: p.moves + 1, pushes: p.pushes + 1 }
      else p
    }

  action _show(p: Position, earlier: List[Position], undone: List[Position]): bool = all {
    worker' = p.worker, crates' = p.crates, moves' = p.moves, pushes' = p.pushes,
    complete' = p.crates.subseteq(GOALS),
    completions' = (if (p.crates.subseteq(GOALS)) 1 else completions),
    _start' = _start, _earlier' = earlier, _undone' = undone,
  }

  action init = {
    nondet start = Set(FIRST_START, SECOND_START).oneOf()
    all {
      worker' = start.worker, crates' = start.crates, moves' = 0, pushes' = 0,
      complete' = start.crates.subseteq(GOALS),
      completions' = (if (start.crates.subseteq(GOALS)) 1 else 0),
      _start' = start, _earlier' = List(), _undone' = List(),
    }
  }

  /// A refused move changes nothing; an accepted one removes the redo choice.
  action moveWorker(direction: str): bool = all {
    DIRECTIONS.contains(direction), moves < MOVE_BOUND,
    val after = _after(_position, direction)
    if (after == _position) _show(_position, _earlier, _undone)
    else _show(after, _earlier.append(_position), List()),
  }

  /// With no earlier position there is nothing to undo and nothing changes.
  action undoMove: bool =
    if (_earlier.length() > 0)
      _show(_earlier.nth(_earlier.length() - 1), _earlier.slice(0, _earlier.length() - 1),
        _undone.append(_position))
    else _show(_position, _earlier, _undone)

  /// With no undone move there is nothing to redo and nothing changes.
  action redoMove: bool =
    if (_undone.length() > 0)
      _show(_undone.nth(_undone.length() - 1), _earlier.append(_position),
        _undone.slice(0, _undone.length() - 1))
    else _show(_position, _earlier, _undone)

  /// Restarting keeps an earlier completion.
  action restartPuzzle: bool = _show(_start, List(), List())

  action step = {
    nondet direction = DIRECTIONS.oneOf()
    any { moveWorker(direction), undoMove, redoMove, restartPuzzle }
  }

  /// The worker and the crates stand only on floor or goals, never on one square together.
  val invPiecesStandOnFloorOrGoals = _standable(worker) and crates.forall(c => _standable(c)) and
    not(crates.contains(worker))
  /// No move adds, removes or merges crates.
  val invCratesAreKept = crates.size() == 2
  /// The counts belong to the position: one move per accepted step, a push only with a move.
  val invCountsBelongToThePosition = moves == _earlier.length() and pushes <= moves
  /// The puzzle is complete exactly when every crate stands on a goal.
  val invCompleteWhenEveryCrateIsOnAGoal = complete == crates.subseteq(GOALS)
  /// A completion counts once, and undo, redo and restart never remove it.
  val invCompletedOnlyOnce = completions <= 1 and (complete implies completions == 1)
}
