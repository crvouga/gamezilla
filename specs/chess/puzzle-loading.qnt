// The team adds or updates puzzles, follows progress, and can stop adding more.
// Accepted puzzles remain available after a stop or failure. An offline device
// keeps its last result; returning online shows the current result.
// Team access is decided by the puzzle-management access decision table.
module puzzle_loading {
  type PuzzleLoading = {
    status: str,
    poolSize: int,
    added: int,
    updated: int,
    broken: int,
  }

  /// What the team can see about adding puzzles in this environment.
  var puzzleLoading: PuzzleLoading
  /// Whether the team's device can reach this environment.
  var online: bool
  var _actual: PuzzleLoading
  var _progressed: bool
  var _refresh: bool
  var _stoppedPoolSize: int

  action init = all {
    puzzleLoading' = { status: "ready", poolSize: 10, added: 0, updated: 0, broken: 0 },
    _actual' = { status: "ready", poolSize: 10, added: 0, updated: 0, broken: 0 },
    online' = true, _progressed' = false, _refresh' = false, _stoppedPoolSize' = 10,
  }

  /// Starting while another addition runs, or without a connection, is refused.
  action addPuzzles = {
    nondet _refreshSource = Set(false, true).oneOf()
    val starts = online and _actual.status != "adding"
    val next = { ..._actual, status: "adding", added: 0, updated: 0, broken: 0 }
    all {
      _actual' = if (starts) next else _actual,
      puzzleLoading' = if (starts) next else puzzleLoading,
      _progressed' = if (starts) false else _progressed,
      _refresh' = if (starts) _refreshSource else _refresh,
      online' = online, _stoppedPoolSize' = _stoppedPoolSize,
    }
  }

  /// Accepted or updated puzzles and broken puzzles become visible before finishing.
  action addSomePuzzles = all {
    _actual.status == "adding", not(_progressed),
    _actual' = { ..._actual, poolSize: _actual.poolSize + (if (_refresh) 0 else 3),
      added: if (_refresh) 0 else 3, updated: if (_refresh) 3 else 0, broken: 2 },
    puzzleLoading' = if (online) { ..._actual, poolSize: _actual.poolSize + (if (_refresh) 0 else 3),
      added: if (_refresh) 0 else 3, updated: if (_refresh) 3 else 0, broken: 2 } else puzzleLoading,
    _progressed' = true, online' = online, _refresh' = _refresh, _stoppedPoolSize' = _stoppedPoolSize,
  }

  /// A finished addition reports every accepted, updated, and broken puzzle.
  action finishAddingPuzzles = {
    val next = { ..._actual, status: "finished",
      poolSize: _actual.poolSize + (if (_progressed or _refresh) 0 else 3),
      added: if (_refresh) 0 else 3, updated: if (_refresh) 3 else 0, broken: 2 }
    all {
      _actual.status == "adding", _actual' = next,
      puzzleLoading' = if (online) next else puzzleLoading,
      online' = online, _progressed' = true, _refresh' = _refresh, _stoppedPoolSize' = _stoppedPoolSize,
    }
  }

  /// Failure preserves every puzzle that was already available.
  action failAddingPuzzles = all {
    _actual.status == "adding",
    _actual' = { ..._actual, status: "failed" },
    puzzleLoading' = if (online) { ..._actual, status: "failed" } else puzzleLoading,
    online' = online, _progressed' = _progressed, _refresh' = _refresh, _stoppedPoolSize' = _stoppedPoolSize,
  }

  /// Stopping keeps accepted puzzles and is refused without a connection or an ongoing addition.
  action stopAddingPuzzles = {
    val stops = online and _actual.status == "adding"
    val next = { ..._actual, status: "stopped" }
    all {
      _actual' = if (stops) next else _actual,
      puzzleLoading' = if (stops) next else puzzleLoading,
      _stoppedPoolSize' = if (stops) _actual.poolSize else _stoppedPoolSize,
      online' = online, _progressed' = _progressed, _refresh' = _refresh,
    }
  }

  /// Following an addition shows its current result when a connection is available.
  action followAddingPuzzles = all {
    puzzleLoading' = if (online) _actual else puzzleLoading,
    _actual' = _actual, online' = online, _progressed' = _progressed,
    _refresh' = _refresh, _stoppedPoolSize' = _stoppedPoolSize,
  }

  action loseConnection = all {
    online, online' = false, puzzleLoading' = puzzleLoading,
    _actual' = _actual, _progressed' = _progressed,
    _refresh' = _refresh, _stoppedPoolSize' = _stoppedPoolSize,
  }

  action comeBackOnline = all {
    not(online), online' = true, puzzleLoading' = _actual,
    _actual' = _actual, _progressed' = _progressed,
    _refresh' = _refresh, _stoppedPoolSize' = _stoppedPoolSize,
  }

  action step = any {
    addPuzzles, addSomePuzzles, finishAddingPuzzles, failAddingPuzzles,
    stopAddingPuzzles, followAddingPuzzles, loseConnection, comeBackOnline,
  }

  /// The team sees only the recognized stages of adding puzzles.
  val invPuzzleLoadingStatus = Set("ready", "adding", "finished", "failed", "stopped").contains(puzzleLoading.status)
  /// Adding, updating, stopping, and failure never shrink the earlier puzzle pool.
  val invPuzzlePoolPreserved = puzzleLoading.poolSize >= 10 and _actual.poolSize >= 10
  /// A connected device shows the environment's current result.
  val invConnectedPuzzleLoadingIsCurrent = online implies all {
    puzzleLoading.status == _actual.status, puzzleLoading.poolSize == _actual.poolSize,
    puzzleLoading.added == _actual.added, puzzleLoading.updated == _actual.updated,
    puzzleLoading.broken == _actual.broken,
  }
  /// A stopped addition cannot add any more puzzles.
  val invStoppedPuzzlesStayPut = _actual.status == "stopped" implies _actual.poolSize == _stoppedPoolSize
  /// Bookkeeping: the chosen puzzles are each counted at most once.
  val invPuzzleCounts = puzzleLoading.added + puzzleLoading.updated <= 3 and
    puzzleLoading.added >= 0 and puzzleLoading.updated >= 0 and
    puzzleLoading.broken >= 0 and puzzleLoading.broken <= 2
}
