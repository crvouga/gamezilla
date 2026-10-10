// Reopening a Synthetic User's app keeps its identity and its current game.
// An ongoing game remains available, and a finished game's result remains final.
// Offline, the Synthetic User keeps its last known activity and game; Recovery
// completes after its connection comes back.
module synthetic_user_continuity {
  type Activity = Browsing | Playing | Finished
  type SyntheticUser = str

  /// Who the Synthetic User is to everyone else.
  var identity: SyntheticUser
  /// What the Synthetic User is doing.
  var activity: Activity
  /// The multiplayer game the Synthetic User returns to, if any.
  var game: str
  /// Bookkeeping: remember the activity and game before reopening.
  var _activityBefore: Activity
  var _gameBefore: str
  /// Bookkeeping: the Synthetic User whose device has no connection.
  var _offline: Set[SyntheticUser]

  action init = {
    nondet initialActivity = Set(Browsing, Playing, Finished).oneOf()
    val initialGame = if (initialActivity == Browsing) "" else "friday-chess"
    all {
      identity' = "Cedar",
      activity' = initialActivity,
      game' = initialGame,
      _activityBefore' = initialActivity,
      _gameBefore' = initialGame,
      _offline' = Set(),
    }
  }

  /// The Synthetic User's app reopens with its connection available.
  action reopenApp = all {
    not(_offline.contains(identity)),
    identity' = identity,
    activity' = activity,
    game' = game,
    _activityBefore' = _activityBefore,
    _gameBefore' = _gameBefore,
    _offline' = _offline,
  }

  /// Bookkeeping: take one Synthetic User's device offline.
  action _loseConnection(who: SyntheticUser) = all {
    not(_offline.contains(who)),
    identity' = identity,
    activity' = activity,
    game' = game,
    _activityBefore' = _activityBefore,
    _gameBefore' = _gameBefore,
    _offline' = _offline.union(Set(who)),
  }

  /// Bookkeeping: bring that device's connection back.
  action _comeBackOnline(who: SyntheticUser) = all {
    _offline.contains(who),
    identity' = identity,
    activity' = activity,
    game' = game,
    _activityBefore' = _activityBefore,
    _gameBefore' = _gameBefore,
    _offline' = _offline.exclude(Set(who)),
  }

  action step = {
    nondet who = Set("Cedar").oneOf()
    any { reopenApp, _loseConnection(who), _comeBackOnline(who) }
  }

  /// Recovery never replaces the Synthetic User's identity.
  val invPersistentIdentity = identity == "Cedar"
  /// Recovery returns the Synthetic User to its current activity.
  val invActivityRestored = activity == _activityBefore
  /// An ongoing game remains the same game after Recovery.
  val invOngoingGamePreserved = (_activityBefore == Playing) implies (game == _gameBefore)
  /// A finished multiplayer result remains final after Recovery.
  val invFinishedGamePreserved = (_activityBefore == Finished) implies (activity == Finished and game == _gameBefore)
  /// Bookkeeping: taking a device offline cannot change the game it last knew.
  val invOfflineKeepsPlace = _offline.contains(identity) implies (game == _gameBefore and activity == _activityBefore)
}
