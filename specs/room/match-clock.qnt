// A timed match between White and Black in a game room.
//
// Either player can start the match, saying how many seconds each of them
// has; White is to move first. The match clock runs down only the time of
// the player to move. When that player moves, they keep the time they have
// left and their opponent is to move. The moment the player to move runs out
// of time the match is over and their opponent wins on time; nothing changes
// the match after that. Nobody can move out of turn, start a match that has
// already started, or win by claiming their opponent has run out of time
// before they have. White and Black both see the match as it stands, with or
// without a connection. A player with no connection cannot start the match,
// move or claim; the match clock still runs.
module match_clock {
  type Player = str

  pure val PLAYERS: Set[Player] = Set("white", "black")
  /// The seconds each player can start a match with.
  pure val TIMES: Set[int] = Set(4, 8)
  /// How many seconds pass at a time.
  pure val WAITS: Set[int] = Set(1, 3, 6)

  /// "not started", "playing" or "over".
  var matchStatus: str
  /// The player whose time the match clock is running down.
  var playerToMove: Player
  /// Each player's time left, in seconds.
  var timeLeft: Player -> int
  /// The player who won on time, or "" while nobody has.
  var winner: str
  /// The match status White's and Black's phones each show.
  var matchShown: Player -> str
  /// Players whose phone has no connection.
  var _offline: Set[Player]
  /// How many times each player has started, moved or claimed, and how many
  /// when their connection went.
  var _done: Player -> int
  var _doneAtCutOff: Player -> int

  pure def opponent(player: Player): Player =
    if (player == "white") "black" else "white"

  action _update(
    newStatus: str,
    newPlayerToMove: Player,
    newTimeLeft: Player -> int,
    newWinner: str,
    newOffline: Set[Player],
    newDone: Player -> int,
    newCutOff: Player -> int,
  ): bool = all {
    matchStatus' = newStatus,
    playerToMove' = newPlayerToMove,
    timeLeft' = newTimeLeft,
    winner' = newWinner,
    matchShown' = PLAYERS.mapBy(_ => newStatus),
    _offline' = newOffline,
    _done' = newDone,
    _doneAtCutOff' = newCutOff,
  }

  def _acted(player: Player): Player -> int =
    _done.set(player, _done.get(player) + 1)

  action _hold: bool =
    _update(matchStatus, playerToMove, timeLeft, winner, _offline, _done, _doneAtCutOff)

  action init =
    _update("not started", "white", PLAYERS.mapBy(_ => 0), "", Set(), PLAYERS.mapBy(_ => 0), PLAYERS.mapBy(_ => 0))

  /// `player` starts the match with `white` and `black` seconds; only a
  /// match that has not started yet starts.
  action startMatch(player: Player, white: int, black: int): bool = all {
    not(_offline.contains(player)),
    if (matchStatus == "not started")
      _update(
        "playing", "white", Map("white" -> white, "black" -> black), "",
        _offline, _acted(player), _doneAtCutOff,
      )
    else
      _update(matchStatus, playerToMove, timeLeft, winner, _offline, _acted(player), _doneAtCutOff),
  }

  /// `player` moves; only the player to move, while the match is playing,
  /// can.
  action move(player: Player): bool = all {
    not(_offline.contains(player)),
    if (matchStatus == "playing" and player == playerToMove)
      _update("playing", opponent(playerToMove), timeLeft, "", _offline, _acted(player), _doneAtCutOff)
    else
      _update(matchStatus, playerToMove, timeLeft, winner, _offline, _acted(player), _doneAtCutOff),
  }

  /// `player` claims `other` has run out of time. While the match is playing
  /// nobody has run out of time yet (the match ends the moment they do), so
  /// the claim changes nothing.
  action claimOutOfTime(player: Player, other: Player): bool = all {
    not(_offline.contains(player)),
    _update(matchStatus, playerToMove, timeLeft, winner, _offline, _acted(player), _doneAtCutOff),
  }

  /// `seconds` pass on the match clock.
  action timePasses(seconds: int): bool = {
    val left = timeLeft.get(playerToMove)
    if (matchStatus == "playing" and seconds >= left)
      _update(
        "over", playerToMove, timeLeft.set(playerToMove, 0), opponent(playerToMove),
        _offline, _done, _doneAtCutOff,
      )
    else if (matchStatus == "playing")
      _update(
        "playing", playerToMove, timeLeft.set(playerToMove, left - seconds), "",
        _offline, _done, _doneAtCutOff,
      )
    else _hold
  }

  /// `player`'s phone loses its connection.
  action _loseConnection(player: Player): bool = all {
    not(_offline.contains(player)),
    _update(
      matchStatus, playerToMove, timeLeft, winner, _offline.union(Set(player)), _done,
      _doneAtCutOff.set(player, _done.get(player)),
    ),
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    _update(matchStatus, playerToMove, timeLeft, winner, Set(), _done, _doneAtCutOff),
  }

  action step = {
    nondet player = PLAYERS.oneOf()
    nondet other = PLAYERS.oneOf()
    nondet white = TIMES.oneOf()
    nondet black = TIMES.oneOf()
    nondet seconds = WAITS.oneOf()
    any {
      startMatch(player, white, black),
      move(player),
      claimOutOfTime(player, other),
      timePasses(seconds),
      _loseConnection(player),
      _connectionReturns,
    }
  }

  /// Someone has won exactly when the match is over.
  val invWinnerOnlyWhenOver = (winner != "") == (matchStatus == "over")

  /// A match that is playing has time left for the player to move.
  val invPlayingHasTimeLeft =
    matchStatus == "playing" implies timeLeft.get(playerToMove) > 0

  /// The player who ran out of time was to move, and their opponent won.
  val invLoserRanOutOfTime =
    matchStatus == "over" implies
      (winner == opponent(playerToMove) and timeLeft.get(playerToMove) == 0)

  /// Nobody's time left grows past what the match started with.
  val invTimeLeftBounded =
    PLAYERS.forall(p => timeLeft.get(p) >= 0 and timeLeft.get(p) <= 8)

  /// Both phones show the match as it stands.
  val invPhonesShowTheMatch = PLAYERS.forall(p => matchShown.get(p) == matchStatus)

  /// With no connection, a player starts, moves and claims no further time.
  /// The match clock still runs.
  val invOfflineDoesNoMore = PLAYERS.forall(p =>
    _offline.contains(p) implies _done.get(p) == _doneAtCutOff.get(p)
  )
}
