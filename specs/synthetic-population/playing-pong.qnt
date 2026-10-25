// A Synthetic User continues its ongoing Pong game to a multiplayer result when connected.
// Going offline keeps that same game; returning lets the activity continue.
module playing_pong {
  type Activity = Playing | Finished
  var activity: Activity
  var identity: str
  var game: str
  /// Bookkeeping: the device without a connection.
  var _offline: Set[str]
  /// Bookkeeping: remember that this game has reached its result.
  var _finished: bool
  /// Bookkeeping: the activity known when the device went offline.
  var _activityBeforeOffline: Activity

  action init = all {
    activity' = Playing,
    identity' = "Cedar",
    game' = "friday-pong",
    _offline' = Set(),
    _finished' = false,
    _activityBeforeOffline' = Playing,
  }

  /// The Synthetic User continues the game it is already playing.
  action continueActivity = all {
    activity == Playing,
    activity' = if (_offline.contains(identity)) Playing else Finished,
    identity' = identity,
    game' = game,
    _offline' = _offline,
    _finished' = not(_offline.contains(identity)),
    _activityBeforeOffline' = _activityBeforeOffline,
  }

  /// Bookkeeping: the device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    activity' = activity,
    identity' = identity,
    game' = game,
    _offline' = _offline.union(Set(who)),
    _finished' = _finished,
    _activityBeforeOffline' = activity,
  }

  /// Bookkeeping: the device's connection returns.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    activity' = activity,
    identity' = identity,
    game' = game,
    _offline' = _offline.exclude(Set(who)),
    _finished' = _finished,
    _activityBeforeOffline' = _activityBeforeOffline,
  }

  action step = any {
    continueActivity,
    _loseConnection("Cedar"),
    _comeBackOnline("Cedar"),
  }

  /// Continuing an activity never replaces the Synthetic User's account.
  val invPersistentIdentity = identity == "Cedar"
  /// Continuing the activity never replaces its ongoing game.
  val invGamePreserved = game == "friday-pong"
  /// An activity that has reached a result remains finished.
  val invFinishedGamePreserved = _finished implies (activity == Finished)
  /// The device keeps its known activity while it has no connection.
  val invOfflineKeepsActivity = _offline.contains(identity) implies (activity == _activityBeforeOffline)
}
