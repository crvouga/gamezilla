// One environment's puzzle pool as the team adds puzzles and follows the result.
// A permitted person starts one addition at a time. Finishing adds only good
// puzzles and reports the broken ones; failure preserves the earlier pool.
// Without a connection, the last result shown stays in place until the
// connection returns, while adding puzzles continues without the person's help.
module puzzle_loading {
  type PuzzleLoading = {
    status: str,
    poolSize: int,
    added: int,
    broken: int,
    permitted: bool,
  }

  /// What the team can see about adding puzzles in this environment.
  var puzzleLoading: PuzzleLoading
  /// Whether the team's device can reach this environment.
  var online: bool
  var _actualStatus: str
  var _actualPoolSize: int
  var _actualAdded: int
  var _actualBroken: int

  action init = {
    nondet permitted = Set(false, true).oneOf()
    all {
      puzzleLoading' = {
        status: "ready", poolSize: 10, added: 0, broken: 0,
        permitted: permitted,
      },
      online' = true,
      _actualStatus' = "ready", _actualPoolSize' = 10,
      _actualAdded' = 0, _actualBroken' = 0,
    }
  }

  /// Starting is refused without team access and while another addition runs.
  action addPuzzles: bool = {
    val starts = puzzleLoading.permitted and online and
      _actualStatus != "adding"
    val refused = online and not(starts)
    all {
      _actualStatus' = if (starts) "adding" else if (refused) "refused" else _actualStatus,
      _actualPoolSize' = _actualPoolSize,
      _actualAdded' = if (starts) 0 else _actualAdded,
      _actualBroken' = if (starts) 0 else _actualBroken,
      puzzleLoading' = if (online) {
        ...puzzleLoading,
        status: if (starts) "adding" else "refused",
        added: if (starts) 0 else puzzleLoading.added,
        broken: if (starts) 0 else puzzleLoading.broken,
      } else puzzleLoading,
      online' = online,
    }
  }

  /// A finished addition makes its accepted and broken counts visible.
  action finishAddingPuzzles: bool = all {
    _actualStatus == "adding",
    _actualStatus' = "finished", _actualPoolSize' = _actualPoolSize + 3,
    _actualAdded' = 3, _actualBroken' = 2,
    puzzleLoading' = if (online) {
      ...puzzleLoading, status: "finished", poolSize: _actualPoolSize + 3,
      added: 3, broken: 2,
    } else puzzleLoading,
    online' = online,
  }

  /// A failed addition reports failure and preserves the earlier puzzle pool.
  action failAddingPuzzles: bool = all {
    _actualStatus == "adding",
    _actualStatus' = "failed", _actualPoolSize' = _actualPoolSize,
    _actualAdded' = 0, _actualBroken' = 0,
    puzzleLoading' = if (online) {
      ...puzzleLoading, status: "failed", added: 0, broken: 0,
    } else puzzleLoading,
    online' = online,
  }

  action loseConnection: bool = all {
    online,
    puzzleLoading' = puzzleLoading, online' = false,
    _actualStatus' = _actualStatus, _actualPoolSize' = _actualPoolSize,
    _actualAdded' = _actualAdded, _actualBroken' = _actualBroken,
  }

  action comeBackOnline: bool = all {
    not(online),
    puzzleLoading' = {
      ...puzzleLoading, status: _actualStatus,
      poolSize: _actualPoolSize, added: _actualAdded, broken: _actualBroken,
    },
    online' = true,
    _actualStatus' = _actualStatus, _actualPoolSize' = _actualPoolSize,
    _actualAdded' = _actualAdded, _actualBroken' = _actualBroken,
  }

  action step = any {
    addPuzzles,
    finishAddingPuzzles,
    failAddingPuzzles,
    loseConnection,
    comeBackOnline,
  }

  /// The team sees only the recognized stages of adding puzzles.
  val invPuzzleLoadingStatus =
    Set("ready", "adding", "finished", "failed", "refused").contains(puzzleLoading.status)

  /// Finishing can grow the puzzle pool; refusal and failure never shrink it.
  val invPuzzlePoolPreserved = puzzleLoading.poolSize >= 10 and _actualPoolSize >= 10

  /// Whenever the device has a connection, it shows the environment's result.
  val invConnectedPuzzleLoadingIsCurrent = online implies all {
    puzzleLoading.status == _actualStatus,
    puzzleLoading.poolSize == _actualPoolSize,
    puzzleLoading.added == _actualAdded,
    puzzleLoading.broken == _actualBroken,
  }

  /// A person outside the team never starts adding puzzles.
  val invOnlyTeamAddsPuzzles = not(puzzleLoading.permitted) implies
    not(Set("adding", "finished", "failed").contains(_actualStatus))
}
