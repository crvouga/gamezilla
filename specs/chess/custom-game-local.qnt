// One host creates an untimed Custom Game with White as themselves and Black
// as a bot. Connection changes never stop their own choices or play. The host
// keeps seeing their own moves, including offline. A guest sees those moves
// while both have a connection, and keeps the move count they already had
// while the host is offline. This small game follows two legal turns; the
// full chess endings belong to the play models.
module custom_game_local {
  pure val PEOPLE = Set("alice", "bob")
  /// The host's current game, including when their device is offline.
  var controlledStatus: str
  var controlledPly: int
  var controlledTurn: str
  /// Black's chosen participant, and the host's readiness before starting.
  var black: str
  var ready: bool
  /// The host sees every own move. A guest sees them while both are connected.
  var shownMoves: str -> int
  var _offline: Set[str]
  var _sealedPly: int

  action _update(status: str, ply: int, turn: str, participant: str, agreed: bool, offline: Set[str]): bool = all {
    controlledStatus' = status, controlledPly' = ply, controlledTurn' = turn,
    black' = participant, ready' = agreed, _offline' = offline,
    shownMoves' = PEOPLE.mapBy(p => if (p == "alice" or (not(offline.contains("alice")) and not(offline.contains(p)))) ply else shownMoves.get(p)),
    _sealedPly' = if (status == "cancelled" or status == "completed") ply else -1,
  }
  action _hold = _update(controlledStatus, controlledPly, controlledTurn, black, ready, _offline)
  action init = {
    nondet beginning = Set("empty", "playing").oneOf()
    all {
      controlledStatus' = if (beginning == "playing") "active" else "none",
      controlledPly' = 0, controlledTurn' = "white",
      black' = if (beginning == "playing") "bot" else "open",
      ready' = beginning == "playing", _offline' = Set(),
      shownMoves' = PEOPLE.mapBy(_ => 0), _sealedPly' = -1,
    }
  }
  /// A new game is separate from a completed or cancelled game.
  action createGame = all {
    Set("none", "completed", "cancelled").contains(controlledStatus),
    _update("configuring", 0, "white", "open", false, _offline),
  }
  action assignBot = all {
    controlledStatus == "configuring", black == "open",
    _update(controlledStatus, controlledPly, controlledTurn, "bot", false, _offline),
  }
  action becomeReady = all {
    controlledStatus == "configuring", not(ready),
    _update(controlledStatus, controlledPly, controlledTurn, black, true, _offline),
  }
  action startGame = all {
    controlledStatus == "configuring", black == "bot", ready,
    _update("active", 0, "white", black, ready, _offline),
  }
  action playCustomMove = all {
    controlledStatus == "active", controlledTurn == "white", controlledPly < 4,
    _update(controlledStatus, controlledPly + 1, "black", black, ready, _offline),
  }
  action botPlays = all {
    controlledStatus == "active", controlledTurn == "black", controlledPly < 4,
    _update(controlledStatus, controlledPly + 1, "white", black, ready, _offline),
  }
  action cancelCustomGame = all {
    Set("configuring", "active").contains(controlledStatus),
    _update("cancelled", controlledPly, controlledTurn, black, false, _offline),
  }
  action resignCustomGame = all {
    controlledStatus == "active",
    _update("completed", controlledPly, controlledTurn, black, ready, _offline),
  }
  /// Reopening and hearing a move again retain the same game and move count.
  action _reopenApp = _hold
  action _repeatMove = _hold
  action _loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(controlledStatus, controlledPly, controlledTurn, black, ready, _offline.union(Set(actor))),
  }
  action _connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(controlledStatus, controlledPly, controlledTurn, black, ready, _offline.exclude(Set(actor))),
  }
  action step = {
    nondet actor = PEOPLE.oneOf()
    any { createGame, assignBot, becomeReady, startGame, playCustomMove, botPlays,
      cancelCustomGame, resignCustomGame, _reopenApp, _repeatMove,
      _loseConnection(actor), _connectionReturns(actor) }
  }
  /// Starting requires the host's agreement and a bot for the other side.
  val invLocalStart = controlledStatus == "active" implies ready and black == "bot"
  /// Every move passes the turn once, and no connection change adds a move.
  val invLocalTurns = controlledPly.in(0.to(4)) and controlledTurn == (if (controlledPly % 2 == 0) "white" else "black")
  /// No absent game has a move, and a terminal game keeps its final move count.
  val invLocalLifecycle = (controlledStatus == "none" implies controlledPly == 0) and
    (Set("completed", "cancelled").contains(controlledStatus) implies controlledPly == _sealedPly)
  /// The host's board remains available and current through every disconnection.
  val invLocalHost = shownMoves.get("alice") == controlledPly
  /// A guest sees the host's move count while both have a connection.
  val invLocalGuest = (not(_offline.contains("alice")) and not(_offline.contains("bob"))) implies shownMoves.get("bob") == controlledPly
}
