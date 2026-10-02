// Alice plays one rated puzzle, Charlie uses another device of Alice's
// account, and Bob watches. The first result belongs to Alice even if her
// app closes as she finishes. Closing an app and losing a connection are
// independent: each device can return in any order, more than once.
// Taking a hint or making a wrong move keeps its effect on the rating;
// retrying and solving afterwards never replaces the first result.
// Once Alice returns with a connection, her result counts once, and every
// connected device of her account agrees. Bob never receives that result.
// Reading stats while returning never loses the result.
// This follows one attempt; the puzzle feed and later attempts are separate.
module puzzle_result_recovery {
  type Device = str
  type Result = Unfinished | CleanSolve | HintedSolve | WrongMove | ShownSolution | Skipped
  pure val DEVICES = Set("alice", "bob", "charlie")
  pure val SOLVER = "alice"
  pure val WATCHER = "bob"
  pure val ACCOUNT_DEVICES = Set("alice", "charlie")
  pure val FINISHES = Set(CleanSolve, HintedSolve, WrongMove, ShownSolution, Skipped)

  /// The attempt's first result, retained while the board is retried or reviewed.
  var firstResult: Result
  /// The result each open app's game log shows, or Unfinished before it counts.
  var gameLog: Device -> str
  /// The result each open app's puzzle rating counts, or Unfinished before it counts.
  var ratedResult: Device -> Result
  var _open: Device -> bool
  var _online: Device -> bool
  var _readingStats: bool
  var _recorded: bool
  var _localResult: Device -> Result
  var _firstDecision: Result

  pure def _outcome(r: Result): str = match r {
    | Unfinished => "unfinished"
    | CleanSolve => "solved"
    | HintedSolve => "solved"
    | WrongMove => "failed"
    | ShownSolution => "failed"
    | Skipped => "abandoned"
  }

  action _update(result: Result, opened: Device -> bool, connected: Device -> bool, readingStats: bool): bool = {
    val counted = _recorded or (result != Unfinished and opened.get(SOLVER) and connected.get(SOLVER))
    val copies = DEVICES.mapBy(d =>
      if (ACCOUNT_DEVICES.contains(d) and counted and opened.get(d) and connected.get(d)) result
      else _localResult.get(d))
    all {
      firstResult' = result,
      _firstDecision' = if (_firstDecision == Unfinished) result else _firstDecision,
      _open' = opened,
      _online' = connected,
      _recorded' = counted,
      _readingStats' = readingStats,
      _localResult' = copies,
      gameLog' = DEVICES.filter(d => opened.get(d)).mapBy(d => _outcome(copies.get(d))),
      ratedResult' = DEVICES.filter(d => opened.get(d)).mapBy(d => copies.get(d)),
    }
  }

  action init = all {
    firstResult' = Unfinished,
    _firstDecision' = Unfinished,
    _open' = DEVICES.mapBy(_ => true),
    _online' = DEVICES.mapBy(_ => true),
    _recorded' = false,
    _readingStats' = false,
    _localResult' = DEVICES.mapBy(_ => Unfinished),
    gameLog' = DEVICES.mapBy(_ => "unfinished"),
    ratedResult' = DEVICES.mapBy(_ => Unfinished),
  }

  /// Alice finishes while her app is open and has a connection.
  action finish(result: Result): bool = all {
    firstResult == Unfinished, not(_readingStats), _open.get(SOLVER), _online.get(SOLVER),
    _update(result, _open, _online, _readingStats),
  }

  /// Alice finishes as her app closes, before she sees the result.
  action finishAsAppCloses(result: Result): bool = all {
    firstResult == Unfinished, not(_readingStats), _open.get(SOLVER), _online.get(SOLVER),
    _update(result, _open.set(SOLVER, false), _online, _readingStats),
  }

  /// Retrying the board and solving keeps the attempt's first result.
  action retryAndSolve: bool = all {
    firstResult != Unfinished, firstResult != Skipped, not(_readingStats),
    _open.get(SOLVER), _online.get(SOLVER),
    _update(firstResult, _open, _online, _readingStats),
  }

  /// Alice reads her stats while the finished result may still be waiting.
  action readStats: bool = all {
    firstResult != Unfinished, _open.get(SOLVER), not(_readingStats),
    _update(firstResult, _open, _online, true),
  }

  /// Someone closes their app; their progress is waiting when they return.
  action closeApp(device: Device): bool = all {
    _open.get(device),
    _update(firstResult, _open.set(device, false), _online, _readingStats),
  }

  /// Someone returns to the same account, including while offline.
  action reopenApp(device: Device): bool = all {
    not(_open.get(device)),
    _update(firstResult, _open.set(device, true), _online, _readingStats),
  }

  /// One device loses its connection without closing its app.
  action _loseConnection(device: Device): bool = all {
    _online.get(device),
    _update(firstResult, _open, _online.set(device, false), _readingStats),
  }

  /// One device's connection returns; the other devices may still be away.
  action _connectionReturns(device: Device): bool = all {
    not(_online.get(device)),
    _update(firstResult, _open, _online.set(device, true), _readingStats),
  }

  /// Waiting or hearing the same result again never counts another attempt.
  action _wait = _update(firstResult, _open, _online, _readingStats)

  action step = {
    nondet device = DEVICES.oneOf()
    nondet result = FINISHES.oneOf()
    any {
      finish(result), finishAsAppCloses(result), retryAndSolve, readStats,
      closeApp(device), reopenApp(device),
      _loseConnection(device), _connectionReturns(device), _wait,
    }
  }

  /// The first result cannot change when a solver retries or returns.
  val invFirstResultSurvives = firstResult == _firstDecision
  /// A game log and puzzle rating always count the same first result.
  val invRatingAndLogAgree = gameLog.keys() == ratedResult.keys() and
    gameLog.keys().forall(d => gameLog.get(d) == _outcome(ratedResult.get(d)))
  /// No open device shows somebody else's result or a different later result.
  val invOnlyFirstResultCounts = gameLog.keys().forall(d =>
    gameLog.get(d) == "unfinished" or (ACCOUNT_DEVICES.contains(d) and gameLog.get(d) == _outcome(firstResult)))
  /// A watcher receives no attempt or puzzle rating for watching.
  val invWatcherIsNeverRated = _localResult.get(WATCHER) == Unfinished
  /// Each connected open account device knows a result once it has counted.
  val invConnectedDevicesAgree = ACCOUNT_DEVICES.forall(d =>
    (_recorded and _open.get(d) and _online.get(d)) implies gameLog.get(d) == _outcome(firstResult))

  val _state = (firstResult, gameLog, ratedResult, _open, _online, _recorded, _readingStats, _localResult, _firstDecision)
  temporal _solverReturns = eventually(always(_open.get(SOLVER) and _online.get(SOLVER)))
  /// A finished attempt eventually counts when the solver can keep using the app.
  temporal liveResultIsNotLost = _solverReturns.implies(
    (firstResult != Unfinished).leadsTo(_recorded))
  /// A returning account device eventually sees the same result and rating.
  temporal liveOtherDeviceAgrees = (_solverReturns and
    eventually(always(_open.get("charlie") and _online.get("charlie")))).implies(
    (firstResult != Unfinished).leadsTo(if (_open.get("charlie"))
      gameLog.get("charlie") == _outcome(firstResult) else false))
}
