// Bob, whether he is a guest or not, plays Sokoban's starter pack. It
// comes with the app, so it is ready for everyone, with or without a
// connection. Bob may start any starter puzzle. Completing one keeps its
// completion, counted once, and offers the next unfinished starter puzzle in
// the pack's order, or the first unfinished one. Continuing the pack returns
// to the last active unfinished puzzle, or the offered one; a complete pack
// offers no unfinished puzzle. Bob's phone starts connected. Without a
// connection he plays the starter pack as usual, and his completions reach
// his tablet when the connection returns. The examples use three starter
// puzzles to stand for the pack's few.
module starter_pack {
  pure val STARTER = Set(0, 1, 2)

  /// The starter puzzle Bob is playing, or -1 before he starts one.
  var activePuzzle: int
  var completed: Set[int]
  /// The starter puzzle offered as the next puzzle, or -1 when every one is completed.
  var offeredPuzzle: int
  /// The completions Bob's tablet shows.
  var otherProgress: Set[int]
  var _online: bool
  var _previousCompleted: Set[int]

  pure def _first(puzzles: Set[int]): int = puzzles.fold(-1, (first, p) =>
    if (first == -1 or p < first) p else first)

  pure def _offered(done: Set[int], active: int): int = {
    val later = STARTER.filter(p => p > active and not(done.contains(p)))
    if (later.size() > 0) _first(later) else _first(STARTER.exclude(done))
  }

  action _keep(active: int, done: Set[int], online: bool): bool = all {
    activePuzzle' = active, completed' = done, offeredPuzzle' = _offered(done, active),
    otherProgress' = (if (online) done else otherProgress),
    _online' = online, _previousCompleted' = completed,
  }

  action init = all {
    activePuzzle' = -1, completed' = Set(), offeredPuzzle' = 0, otherProgress' = Set(),
    _online' = true, _previousCompleted' = Set(),
  }

  /// Starting a starter puzzle needs neither an account nor a connection.
  action playStarterPuzzle(puzzle: int): bool = all {
    STARTER.contains(puzzle), _keep(puzzle, completed, _online),
  }

  /// Completing a starter puzzle again still counts it once.
  action completeStarterPuzzle: bool = all {
    STARTER.contains(activePuzzle),
    _keep(activePuzzle, completed.union(Set(activePuzzle)), _online),
  }

  /// Continuing returns to the last active unfinished puzzle, or the offered
  /// one; a complete pack offers none and nothing changes.
  action continueStarterPack: bool =
    if (STARTER.contains(activePuzzle) and not(completed.contains(activePuzzle)))
      _keep(activePuzzle, completed, _online)
    else if (offeredPuzzle != -1) _keep(offeredPuzzle, completed, _online)
    else _keep(activePuzzle, completed, _online)

  /// Model-only: the phone loses its connection and keeps playing.
  action _loseConnection: bool = all { _online, _keep(activePuzzle, completed, false) }

  /// Completions made offline reach Bob's tablet.
  action connectionReturns: bool = all { not(_online), _keep(activePuzzle, completed, true) }

  action step = {
    nondet puzzle = STARTER.oneOf()
    any { playStarterPuzzle(puzzle), completeStarterPuzzle, continueStarterPack,
      _loseConnection, connectionReturns }
  }

  /// The offered next puzzle is unfinished, and only a complete pack offers none.
  val invNextPuzzleIsUnfinished = (offeredPuzzle == -1) == (completed == STARTER) and
    (offeredPuzzle != -1 implies not(completed.contains(offeredPuzzle)))
  /// Completions are starter puzzles and are never lost.
  val invCompletionsAreKept = completed.subseteq(STARTER) and _previousCompleted.subseteq(completed)
  /// Bob plays only starter puzzles here.
  val invPlayingAStarterPuzzle = activePuzzle == -1 or STARTER.contains(activePuzzle)
  /// Connected devices show the same completions.
  val invConnectedDevicesAgree = _online implies otherProgress == completed
  /// Offline completions stay on the phone until the connection returns.
  val invOfflineCompletionsAreKept = not(_online) implies otherProgress.subseteq(completed)
}
