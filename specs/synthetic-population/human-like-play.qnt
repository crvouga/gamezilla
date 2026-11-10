// Cedar, a Synthetic User, plays an ongoing game against Bob. Cedar makes
// only legal moves, and each move takes a human-like thinking time: at least
// 2 seconds and at most 20, never the same whole number of seconds for two
// moves in a row. After a finished game either of them may offer a rematch;
// Cedar answers Bob's offer, and sometimes offers one itself, but never plays
// more than 3 games in a row against Bob.
// With no connection, Cedar makes no move and Bob offers no rematch; the game
// stays as it was until the connection returns.
module human_like_play {
  type Activity = Playing | Finished

  /// Bookkeeping: whether Cedar's game against Bob is ongoing or finished (the game's own status belongs to Games).
  var _activity: Activity
  /// Every move Cedar made took at least 2 seconds and at most 20.
  var thinkingTimeHumanLike: bool
  /// Cedar's latest move took a different whole number of seconds from the one before.
  var thinkingTimeChanged: bool
  /// How many games in a row Cedar has played against Bob.
  var gamesInARow: int
  /// Bookkeeping: whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: how many moves Cedar has made.
  var _moves: int
  /// Bookkeeping: Cedar's moves when its device went offline.
  var _movesBeforeOffline: int
  /// Bookkeeping: Cedar's moves when its latest game finished.
  var _movesAtFinish: int

  action init = all {
    _activity' = Playing,
    thinkingTimeHumanLike' = true,
    thinkingTimeChanged' = true,
    gamesInARow' = 1,
    _offline' = Set(),
    _moves' = 0,
    _movesBeforeOffline' = 0,
    _movesAtFinish' = 0,
  }

  /// Cedar continues its current activity by making its next move.
  action continueActivity = all {
    _activity == Playing,
    not(_offline.contains("Cedar")),
    _activity' = _activity,
    thinkingTimeHumanLike' = thinkingTimeHumanLike,
    thinkingTimeChanged' = thinkingTimeChanged,
    gamesInARow' = gamesInARow,
    _offline' = _offline,
    _moves' = _moves + 1,
    _movesBeforeOffline' = _movesBeforeOffline,
    _movesAtFinish' = _movesAtFinish,
  }

  /// Bookkeeping: the ongoing game reaches its multiplayer result.
  action _finishGame = all {
    _activity == Playing,
    _activity' = Finished,
    thinkingTimeHumanLike' = thinkingTimeHumanLike,
    thinkingTimeChanged' = thinkingTimeChanged,
    gamesInARow' = gamesInARow,
    _offline' = _offline,
    _moves' = _moves,
    _movesBeforeOffline' = _movesBeforeOffline,
    _movesAtFinish' = _moves,
  }

  /// Bob or Cedar offers a rematch after a finished game; the other accepts or declines.
  /// Cedar never accepts or offers a fourth game in a row against Bob.
  action offerRematch(who: str, accepted: bool): bool = all {
    _activity == Finished,
    not(_offline.contains(who)),
    accepted implies (gamesInARow < 3),
    _activity' = if (accepted) Playing else Finished,
    thinkingTimeHumanLike' = thinkingTimeHumanLike,
    thinkingTimeChanged' = thinkingTimeChanged,
    gamesInARow' = if (accepted) gamesInARow + 1 else gamesInARow,
    _offline' = _offline,
    _moves' = _moves,
    _movesBeforeOffline' = _movesBeforeOffline,
    _movesAtFinish' = _movesAtFinish,
  }

  /// Bookkeeping: a device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    _activity' = _activity,
    thinkingTimeHumanLike' = thinkingTimeHumanLike,
    thinkingTimeChanged' = thinkingTimeChanged,
    gamesInARow' = gamesInARow,
    _offline' = _offline.union(Set(who)),
    _moves' = _moves,
    _movesBeforeOffline' = _moves,
    _movesAtFinish' = _movesAtFinish,
  }

  /// Bookkeeping: that device's connection comes back.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    _activity' = _activity,
    thinkingTimeHumanLike' = thinkingTimeHumanLike,
    thinkingTimeChanged' = thinkingTimeChanged,
    gamesInARow' = gamesInARow,
    _offline' = _offline.exclude(Set(who)),
    _moves' = _moves,
    _movesBeforeOffline' = _movesBeforeOffline,
    _movesAtFinish' = _movesAtFinish,
  }

  action step = {
    nondet who = Set("Bob", "Cedar").oneOf()
    nondet accepted = Set(true, false).oneOf()
    any {
      continueActivity,
      _finishGame,
      offerRematch(who, accepted),
      _loseConnection(who),
      _comeBackOnline(who),
    }
  }

  /// Every move takes at least 2 seconds and at most 20.
  val invThinkingTimeHumanLike = thinkingTimeHumanLike
  /// No two moves in a row take the same whole number of seconds.
  val invThinkingTimeVaries = (_moves >= 2) implies thinkingTimeChanged
  /// Cedar plays at most 3 games in a row against the same opponent.
  val invAtMostThreeInARow = gamesInARow >= 1 and gamesInARow <= 3
  /// Bookkeeping: Cedar makes no move in a finished game.
  val invNoMoveAfterResult = (_activity == Finished) implies (_moves == _movesAtFinish)
  /// Bookkeeping: Cedar makes no move while its device is offline.
  val invOfflineMakesNoMove = _offline.contains("Cedar") implies (_moves == _movesBeforeOffline)
}
