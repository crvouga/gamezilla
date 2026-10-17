// One host creates an untimed custom game with themselves on the first side
// and a bot on the second. Connection changes never stop their own choices
// or play. The host keeps seeing their own moves, including with no
// connection. A guest sees those moves while both have a connection, and
// keeps the number of moves they already saw while the host has none. This
// small custom game follows the first four moves of the game's own rules; how
// a custom game is won belongs to the play models.
module custom_game_local {
  pure val PEOPLE = Set("alice", "bob")
  /// The host's current custom game, including when their device has no connection.
  var status: str
  var movesPlayed: int
  var sideToMove: str
  /// The second side's participant, and the host's readiness before starting.
  var secondSide: str
  var ready: bool
  /// The host sees every move of their own. A guest sees them while both are connected.
  var movesShown: str -> int
  var _offline: Set[str]
  var _sealedMoves: int

  action _update(newStatus: str, moves: int, turn: str, participant: str, agreed: bool, offline: Set[str]): bool = all {
    status' = newStatus, movesPlayed' = moves, sideToMove' = turn,
    secondSide' = participant, ready' = agreed, _offline' = offline,
    movesShown' = PEOPLE.mapBy(p => if (p == "alice" or (not(offline.contains("alice")) and not(offline.contains(p)))) moves else movesShown.get(p)),
    _sealedMoves' = if (newStatus == "cancelled" or newStatus == "completed") moves else -1,
  }
  action _hold = _update(status, movesPlayed, sideToMove, secondSide, ready, _offline)
  action init = {
    nondet beginning = Set("empty", "playing").oneOf()
    all {
      status' = if (beginning == "playing") "active" else "none",
      movesPlayed' = 0, sideToMove' = "first",
      secondSide' = if (beginning == "playing") "bot" else "open",
      ready' = beginning == "playing", _offline' = Set(),
      movesShown' = PEOPLE.mapBy(_ => 0), _sealedMoves' = -1,
    }
  }
  /// A new custom game is separate from a finished or cancelled one.
  action createGame = all {
    Set("none", "completed", "cancelled").contains(status),
    _update("configuring", 0, "first", "open", false, _offline),
  }
  action assignBot = all {
    status == "configuring", secondSide == "open",
    _update(status, movesPlayed, sideToMove, "bot", false, _offline),
  }
  action becomeReady = all {
    status == "configuring", not(ready),
    _update(status, movesPlayed, sideToMove, secondSide, true, _offline),
  }
  action startGame = all {
    status == "configuring", secondSide == "bot", ready,
    _update("active", 0, "first", secondSide, ready, _offline),
  }
  action playCustomMove = all {
    status == "active", sideToMove == "first", movesPlayed < 4,
    _update(status, movesPlayed + 1, "second", secondSide, ready, _offline),
  }
  action botPlays = all {
    status == "active", sideToMove == "second", movesPlayed < 4,
    _update(status, movesPlayed + 1, "first", secondSide, ready, _offline),
  }
  action cancelCustomGame = all {
    Set("configuring", "active").contains(status),
    _update("cancelled", movesPlayed, sideToMove, secondSide, false, _offline),
  }
  action resignCustomGame = all {
    status == "active",
    _update("completed", movesPlayed, sideToMove, secondSide, ready, _offline),
  }
  /// Opening the app again and hearing a move again keep the same custom game and moves.
  action _reopenApp = _hold
  action _repeatMove = _hold
  action _loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(status, movesPlayed, sideToMove, secondSide, ready, _offline.union(Set(actor))),
  }
  action _connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(status, movesPlayed, sideToMove, secondSide, ready, _offline.exclude(Set(actor))),
  }
  action step = {
    nondet actor = PEOPLE.oneOf()
    any { createGame, assignBot, becomeReady, startGame, playCustomMove, botPlays,
      cancelCustomGame, resignCustomGame, _reopenApp, _repeatMove,
      _loseConnection(actor), _connectionReturns(actor) }
  }
  /// Starting needs the host to be ready and a bot on the second side.
  val invLocalStart = status == "active" implies ready and secondSide == "bot"
  /// Every move passes the turn once, and no connection change adds a move.
  val invLocalTurns = movesPlayed.in(0.to(4)) and sideToMove == (if (movesPlayed % 2 == 0) "first" else "second")
  /// No absent custom game has a move, and a finished or cancelled one keeps its moves.
  val invLocalLifecycle = (status == "none" implies movesPlayed == 0) and
    (Set("completed", "cancelled").contains(status) implies movesPlayed == _sealedMoves)
  /// The host's board stays available and current through every loss of connection.
  val invLocalHost = movesShown.get("alice") == movesPlayed
  /// A guest sees the host's moves while both have a connection.
  val invLocalGuest = (not(_offline.contains("alice")) and not(_offline.contains("bob"))) implies movesShown.get("bob") == movesPlayed
}
