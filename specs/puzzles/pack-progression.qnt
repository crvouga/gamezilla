// Bob plays River and Valley in either order in one published pack edition.
// Continuing offers his last active unfinished puzzle, otherwise the first
// unfinished puzzle in the pack. Each puzzle edition counts once; replay and
// restart never erase completion. The phone starts connected. Offline progress
// survives reopening and reaches Bob's tablet when the connection returns.
module pack_progression {
  pure val PUZZLES = Set(0, 1)
  var started: Set[int]
  var completed: Set[int]
  var activePuzzle: int
  var offeredPuzzle: int
  var progress: int -> str
  var otherProgress: int -> str
  var completionCount: int
  var packComplete: bool
  var _online: bool
  var _previousCompleted: Set[int]

  pure def _offer(complete: Set[int], active: int): int =
    if (active >= 0 and not(complete.contains(active))) active
    else if (not(complete.contains(0))) 0
    else if (not(complete.contains(1))) 1
    else -1

  action _keep(played: Set[int], complete: Set[int], active: int, online: bool): bool = {
    val shown = PUZZLES.mapBy(p => if (complete.contains(p)) "completed"
      else if (played.contains(p)) "in progress" else "unplayed")
    all {
      started' = played, completed' = complete, activePuzzle' = active,
      offeredPuzzle' = _offer(complete, active), progress' = shown,
      otherProgress' = (if (online) shown else otherProgress),
      completionCount' = complete.size(), packComplete' = (complete == PUZZLES),
      _online' = online, _previousCompleted' = completed,
    }
  }

  action init = all {
    started' = Set(), completed' = Set(), activePuzzle' = -1, offeredPuzzle' = 0,
    progress' = PUZZLES.mapBy(_ => "unplayed"),
    otherProgress' = PUZZLES.mapBy(_ => "unplayed"),
    completionCount' = 0, packComplete' = false, _online' = true,
    _previousCompleted' = Set(),
  }

  /// Opening or returning to the pack reports the same personal progress.
  action openPack: bool = _keep(started, completed, activePuzzle, _online)

  /// Any puzzle can be started, including one later in the pack or already completed.
  action startPackPuzzle(puzzle: int): bool = all {
    PUZZLES.contains(puzzle), _keep(started.union(Set(puzzle)), completed, puzzle, _online),
  }

  /// Finishing counts the chosen edition once, however often it is replayed.
  action completePackPuzzle: bool = all {
    started.contains(activePuzzle),
    _keep(started, completed.union(Set(activePuzzle)), activePuzzle, _online),
  }

  /// A fresh attempt retains the completed edition's place in pack progress.
  action restartPackPuzzle: bool = all {
    started.contains(activePuzzle), _keep(started, completed, activePuzzle, _online),
  }

  /// Continuing restores the last unfinished puzzle; a complete pack offers none.
  action continuePack: bool =
    if (offeredPuzzle == -1) _keep(started, completed, activePuzzle, _online)
    else _keep(started.union(Set(offeredPuzzle)), completed, offeredPuzzle, _online)

  /// Reopening keeps personal completion and the last active puzzle, also offline.
  action reopenApp: bool = _keep(started, completed, activePuzzle, _online)

  /// Model-only: the phone loses its connection without discarding progress.
  action _loseConnection: bool = all {
    _online, _keep(started, completed, activePuzzle, false),
  }

  /// The tablet shows the same completion when the phone returns online.
  action connectionReturns: bool = all {
    not(_online), _keep(started, completed, activePuzzle, true),
  }

  action step = {
    nondet puzzle = PUZZLES.oneOf()
    any { openPack, startPackPuzzle(puzzle), completePackPuzzle, restartPackPuzzle,
      continuePack, reopenApp, _loseConnection, connectionReturns }
  }

  /// Completion names only a puzzle played from this pack's chosen editions.
  val invCompletedPuzzlesWerePlayed = completed.subseteq(started) and started.subseteq(PUZZLES)
  /// Each chosen puzzle contributes at most once to completion.
  val invCompletionCountIsDistinct = completionCount == completed.size()
  /// All and only completed chosen editions complete the pack.
  val invPackCompletionRequiresEveryPuzzle = packComplete == (completed == PUZZLES)
  /// Every puzzle shows its own personal progress.
  val invProgressMatchesPlay = PUZZLES.forall(p => progress.get(p) ==
    (if (completed.contains(p)) "completed" else if (started.contains(p)) "in progress" else "unplayed"))
  /// Continuing prefers the last active unfinished puzzle, then follows pack order.
  val invContinueOffersUnfinishedPlay = offeredPuzzle == _offer(completed, activePuzzle)
  val invCompletionNeverDisappears = _previousCompleted.subseteq(completed)
  val invConnectedDevicesAgree = _online implies otherProgress == progress
  /// Offline progress is kept; another device cannot count a completion not on the phone.
  val invOfflineProgressIsKept = not(_online) implies PUZZLES.forall(p =>
    otherProgress.get(p) == "completed" implies completed.contains(p))
}
