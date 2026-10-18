// Alice plays one rated puzzle of the game, Charlie uses another device of
// Alice's account, and Bob watches. It holds for every game that offers
// puzzles, and runs once for each of them; each game's game log and puzzle
// rating are its own. The first result belongs to Alice even if her app
// closes as she finishes. Closing an app and losing a connection are
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
  var _firstResult: Result
  /// The result shown when open apps read their game logs.
  var gameLog: Device -> str
  /// The result reflected in those apps' displayed puzzle ratings.
  var ratedResult: Device -> Result
  var _open: Device -> bool
  var _online: Device -> bool
  var _readingStats: bool
  var _joined: Set[Device]
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

  action _update(result: Result, opened: Device -> bool, connected: Device -> bool, readingStats: bool, joined: Set[Device]): bool = {
    val counted = _recorded or (result != Unfinished and ACCOUNT_DEVICES.exists(d => joined.contains(d) and opened.get(d) and connected.get(d)))
    val copies = DEVICES.mapBy(d =>
      if (ACCOUNT_DEVICES.contains(d) and counted and opened.get(d) and connected.get(d)) result
      else _localResult.get(d))
    all {
      _firstResult' = result,
      _firstDecision' = if (_firstDecision == Unfinished) result else _firstDecision,
      _open' = opened,
      _online' = connected,
      _recorded' = counted,
      _readingStats' = readingStats,
      _joined' = joined,
      _localResult' = copies,
      gameLog' = DEVICES.filter(d => readingStats and joined.contains(d) and opened.get(d)).mapBy(d => _outcome(copies.get(d))),
      ratedResult' = DEVICES.filter(d => readingStats and joined.contains(d) and opened.get(d)).mapBy(d => copies.get(d)),
    }
  }

  action init = all {
    _firstResult' = Unfinished,
    _firstDecision' = Unfinished,
    _open' = DEVICES.mapBy(_ => true),
    _online' = DEVICES.mapBy(_ => true),
    _recorded' = false,
    _joined' = Set(SOLVER, WATCHER),
    _readingStats' = false,
    _localResult' = DEVICES.mapBy(_ => Unfinished),
    gameLog' = Map(),
    ratedResult' = Map(),
  }

  /// Alice finishes while her app is open and has a connection.
  action finish(result: Result): bool = all {
    _firstResult == Unfinished, not(_readingStats), _open.get(SOLVER), _online.get(SOLVER),
    _update(result, _open, _online, _readingStats, _joined),
  }

  /// Alice finishes as her app closes, before she sees the result.
  action finishAsAppCloses(result: Result): bool = all {
    _firstResult == Unfinished, not(_readingStats), _open.get(SOLVER), _online.get(SOLVER),
    _update(result, _open.set(SOLVER, false), _online, _readingStats, _joined),
  }

  /// Both devices finish while apart, possibly differently. After both return,
  /// the result counted first remains the only counted result.
  action finishAlongsideOtherDevice(result: Result, otherResult: Result): bool = all {
    _firstResult == Unfinished, not(_readingStats),
    _open.get(SOLVER), _online.get(SOLVER),
    _open.get("charlie"), _online.get("charlie"),
    FINISHES.contains(otherResult),
    _update(result, _open, _online, _readingStats, _joined.union(Set("charlie"))),
  }

  /// Retrying the board and solving keeps the attempt's first result.
  action retryAndSolve: bool = all {
    _firstResult != Unfinished, not(_readingStats),
    _open.get(SOLVER), _online.get(SOLVER),
    _update(_firstResult, _open, _online, _readingStats, _joined),
  }

  /// Alice reads her stats before a result or while a finished result is waiting.
  action readStats: bool = all {
    _open.get(SOLVER), not(_readingStats),
    _update(_firstResult, _open, _online, true, _joined),
  }

  /// The account's other device reads its stats for the first time online.
  /// Afterwards it can reopen those stats with or without a connection.
  action readStatsOnOtherDevice: bool = all {
    _open.get(SOLVER),
    _open.get("charlie"), _online.get("charlie"), not(_joined.contains("charlie")),
    _update(_firstResult, _open, _online, true, _joined.union(Set("charlie"))),
  }

  /// Someone closes their app; their progress is waiting when they return.
  action closeApp(device: Device): bool = all {
    _open.get(device),
    _update(_firstResult, _open.set(device, false), _online, _readingStats, _joined),
  }

  /// Someone returns to the same account, including while offline.
  action reopenApp(device: Device): bool = all {
    not(_open.get(device)),
    _update(_firstResult, _open.set(device, true), _online, _readingStats, _joined),
  }

  /// One device loses its connection without closing its app.
  action _loseConnection(device: Device): bool = all {
    _online.get(device),
    _update(_firstResult, _open, _online.set(device, false), _readingStats, _joined),
  }

  /// One device's connection returns; the other devices may still be away.
  action connectionReturns(device: Device): bool = all {
    not(_online.get(device)),
    _update(_firstResult, _open, _online.set(device, true), _readingStats, _joined),
  }

  /// Waiting or hearing the same result again never counts another attempt.
  action _wait = _update(_firstResult, _open, _online, _readingStats, _joined)

  action step = {
    nondet device = DEVICES.oneOf()
    nondet result = FINISHES.oneOf()
    nondet otherResult = FINISHES.oneOf()
    any {
      finish(result), finishAsAppCloses(result), retryAndSolve, readStats, readStatsOnOtherDevice,
      finishAlongsideOtherDevice(result, otherResult),
      closeApp(device), reopenApp(device),
      _loseConnection(device), connectionReturns(device), _wait,
    }
  }

  /// The first result cannot change when a solver retries or returns.
  val invFirstResultSurvives = _firstResult == _firstDecision
  /// A game log and puzzle rating always count the same first result.
  val invRatingAndLogAgree = gameLog.keys() == ratedResult.keys() and
    gameLog.keys().forall(d => gameLog.get(d) == _outcome(ratedResult.get(d)))
  /// No open device shows somebody else's result or a different later result.
  val invOnlyFirstResultCounts = gameLog.keys().forall(d =>
    gameLog.get(d) == "unfinished" or (ACCOUNT_DEVICES.contains(d) and gameLog.get(d) == _outcome(_firstResult)))
  /// A watcher receives no attempt or puzzle rating for watching.
  val invWatcherIsNeverRated = _localResult.get(WATCHER) == Unfinished
  /// Each connected open account device knows a result once it has counted.
  val invConnectedDevicesAgree = ACCOUNT_DEVICES.forall(d =>
    (_recorded and _readingStats and _joined.contains(d) and _open.get(d) and _online.get(d)) implies gameLog.get(d) == _outcome(_firstResult))

  val _state = (_firstResult, gameLog, ratedResult, _open, _online, _recorded, _readingStats, _joined, _localResult, _firstDecision)
  temporal _solverReturns = eventually(always(_open.get(SOLVER) and _online.get(SOLVER)))
  /// A finished attempt eventually counts when the solver can keep using the app.
  temporal liveResultIsNotLost = _solverReturns.implies(
    (_firstResult != Unfinished).leadsTo(_recorded))
  /// A returning account device eventually sees the same result and rating.
  temporal liveOtherDeviceAgrees = (_solverReturns and
    eventually(always(_readingStats and _joined.contains("charlie") and _open.get("charlie") and _online.get("charlie")))).implies(
    (_firstResult != Unfinished).leadsTo(if (_readingStats and _joined.contains("charlie") and _open.get("charlie"))
      gameLog.get("charlie") == _outcome(_firstResult) else false))
}
