// White and Black play a timed match with four seconds each. Their clocks
// pause while neither player can use the match. Returning keeps the same
// match, player to move and time left. A player alone losing their own
// connection does not pause an available match.
// Each player can independently lose their connection. Nobody with no
// connection can start or move, but neither player's clock waits for them.
// Every started match eventually ends if time continues and the room returns.
module match_recovery {
  pure val PLAYERS = Set("white", "black")
  pure def _opponent(p: str): str = if (p == "white") "black" else "white"

  /// The match is not started, playing, or over.
  var matchStatus: str
  /// The player to move while the match is playing.
  var playerToMove: str
  /// The player who won, or nobody before the match ends.
  var winner: str
  /// How many of the four seconds each player has left.
  var timeLeft: str -> int
  /// Whether the shared match clock is paused for both players.
  var clocksPaused: bool
  var _previousAvailable: bool
  var _available: bool
  var _online: str -> bool
  var _firstWinner: str
  var _previousTime: str -> int
  var _previousStatus: str

  action _update(status: str, turn: str, won: str, left: str -> int, available: bool, online: str -> bool): bool = all {
    matchStatus' = status, playerToMove' = turn, winner' = won, timeLeft' = left,
    _available' = available, _online' = online,
    clocksPaused' = (status == "playing" and not(available)),
    _previousAvailable' = _available,
    _firstWinner' = if (_firstWinner == "") won else _firstWinner,
    _previousTime' = timeLeft, _previousStatus' = matchStatus,
  }
  action _settle(left: str -> int, available: bool, online: str -> bool): bool = {
    val expired = matchStatus == "playing" and left.get(playerToMove) == 0 and available
    _update(if (expired) "over" else matchStatus, playerToMove,
      if (expired) _opponent(playerToMove) else winner, left, available, online)
  }
  action init = all {
    matchStatus' = "not started", playerToMove' = "white", winner' = "",
    timeLeft' = PLAYERS.mapBy(_ => 0), _available' = true,
    _online' = PLAYERS.mapBy(_ => true), _firstWinner' = "",
    clocksPaused' = false, _previousAvailable' = true,
    _previousTime' = PLAYERS.mapBy(_ => 0), _previousStatus' = "not started",
  }

  /// Either connected player starts a match that has not started.
  action startMatch(player: str): bool = all {
    _available, _online.get(player), matchStatus == "not started",
    _update("playing", "white", "", PLAYERS.mapBy(_ => 4), true, _online),
  }
  /// White starts as the room becomes unavailable, before hearing back.
  action _roomStopsAsMatchStarts = all {
    _available, _online.get("white"), matchStatus == "not started",
    _update("playing", "white", "", PLAYERS.mapBy(_ => 4), false, _online),
  }
  /// A connected player whose turn it is moves while they have time left.
  action move(player: str): bool = all {
    _available, _online.get(player), matchStatus == "playing", player == playerToMove,
    timeLeft.get(player) > 0,
    _update(matchStatus, _opponent(player), winner, timeLeft, _available, _online),
  }
  /// An accepted move keeps the next player to move while the clock is paused.
  action _roomStopsAsMoveCounts(player: str): bool = all {
    _available, _online.get(player), matchStatus == "playing", player == playerToMove,
    timeLeft.get(player) > 0,
    _update(matchStatus, _opponent(player), winner, timeLeft, false, _online),
  }
  /// Time is spent only while the shared match is available.
  action timePasses: bool = {
    val left = timeLeft.get(playerToMove)
    _settle(if (matchStatus == "playing" and _available and left > 0) timeLeft.set(playerToMove, left - 1)
      else timeLeft, _available, _online)
  }
  action _roomStops = all { _available, _settle(timeLeft, false, _online) }
  action _roomReturns = all { not(_available), _settle(timeLeft, true, _online) }
  action _loseConnection(player: str): bool = all {
    _online.get(player), _settle(timeLeft, _available, _online.set(player, false)),
  }
  action _connectionReturns(player: str): bool = all {
    not(_online.get(player)), _settle(timeLeft, _available, _online.set(player, true)),
  }
  action _wait = _settle(timeLeft, _available, _online)
  action step = {
    nondet player = PLAYERS.oneOf()
    any {
      startMatch(player), move(player), timePasses,
      _roomStopsAsMatchStarts, _roomStopsAsMoveCounts(player), _roomStops, _roomReturns,
      _loseConnection(player), _connectionReturns(player), _wait,
    }
  }
  /// Only an ended match has a winner.
  val invWinnerOnlyWhenOver = (winner != "") == (matchStatus == "over")
  /// A player never receives extra time, including while disconnected.
  val invTimeNeverGrows = PLAYERS.forall(p =>
    timeLeft.get(p) >= 0 and timeLeft.get(p) <= 4 and
    (_previousStatus != "not started" implies timeLeft.get(p) <= _previousTime.get(p)))
  /// Losing a connection cannot restart the disconnected player's clock.
  val invDisconnectedClockNeverRestarts = PLAYERS.forall(p =>
    (not(_online.get(p)) and _previousStatus != "not started") implies
      timeLeft.get(p) <= _previousTime.get(p))
  /// The player whose time ran out loses to their opponent.
  val invExpiredPlayerLoses = matchStatus == "over" implies
    timeLeft.get(playerToMove) == 0 and winner == _opponent(playerToMove)
  /// Returning cannot leave a usable match playing with an expired clock.
  val invNoUsableExpiredMatch = (_available and matchStatus == "playing") implies timeLeft.get(playerToMove) > 0
  /// No later action, outage or return can change a decided winner.
  val invWinnerPermanent = _firstWinner != "" implies winner == _firstWinner
  /// A paused clock cannot spend time, and returning cannot replace that time.
  val invPausedTimeIsKept = (_previousStatus == "playing" and not(_previousAvailable)) implies timeLeft == _previousTime
  /// People see a pause exactly while the shared playing match is unavailable.
  val invPauseIsShown = clocksPaused == (matchStatus == "playing" and not(_available))
  val _state = (clocksPaused, _previousAvailable, matchStatus, playerToMove, winner, timeLeft, _available, _online, _firstWinner, _previousTime, _previousStatus)
  /// Time keeps passing, and the room eventually remains available.
  temporal _recovery = eventually(always(_available)) and timePasses.weakFair(_state)
  /// A playing match eventually ends even if both players lose their connections.
  temporal liveStartedMatchEnds = _recovery.implies((matchStatus == "playing").leadsTo(matchStatus == "over"))
}
