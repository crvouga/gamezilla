// Cedar, Maple and Birch are Synthetic Users, each with its own daily
// schedule. When its daily schedule begins, a Synthetic User comes online now,
// unless as many Synthetic Users as the desired synthetic population already
// are. When its daily schedule ends it is no longer online now, except that a
// Synthetic User in an ongoing game finishes that game first and starts
// nothing new. Apart from Synthetic Users finishing an ongoing game, no more
// Synthetic Users are online now than the desired synthetic population.
// With no connection, a Synthetic User starts no new activity; it carries on
// once its connection returns.
module daily_rhythm {
  /// The Synthetic Users whose daily schedule says they tend to be online now.
  var onSchedule: Set[str]
  /// The Synthetic Users online now.
  var onlineNow: Set[str]
  /// The Synthetic Users playing an ongoing game.
  var playing: Set[str]
  /// The desired synthetic population.
  var desiredPopulation: int
  /// Bookkeeping: Synthetic Users online now only to finish an ongoing game.
  var _finishing: Set[str]
  /// Bookkeeping: the Synthetic Users whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: who was playing when a device went offline.
  var _playingBeforeOffline: Set[str]

  pure val SYNTHETIC_USERS = Set("Cedar", "Maple", "Birch")

  action init = {
    nondet desired = 0.to(3).oneOf()
    all {
      onSchedule' = Set(),
      onlineNow' = Set(),
      playing' = Set(),
      desiredPopulation' = desired,
      _finishing' = Set(),
      _offline' = Set(),
      _playingBeforeOffline' = Set(),
    }
  }

  /// A Synthetic User's daily schedule begins in its home region.
  action scheduleBegins(who: str): bool = all {
    not(onSchedule.contains(who)),
    onSchedule' = onSchedule.union(Set(who)),
    onlineNow' = if (not(onlineNow.contains(who)) and onlineNow.size() - _finishing.size() < desiredPopulation)
      onlineNow.union(Set(who))
    else onlineNow,
    playing' = playing,
    desiredPopulation' = desiredPopulation,
    _finishing' = if (_finishing.contains(who) and onlineNow.size() - _finishing.size() < desiredPopulation)
      _finishing.exclude(Set(who))
    else _finishing,
    _offline' = _offline,
    _playingBeforeOffline' = _playingBeforeOffline,
  }

  /// A Synthetic User's daily schedule ends; it finishes an ongoing game first.
  action scheduleEnds(who: str): bool = all {
    onSchedule.contains(who),
    onSchedule' = onSchedule.exclude(Set(who)),
    onlineNow' = if (playing.contains(who)) onlineNow else onlineNow.exclude(Set(who)),
    playing' = playing,
    desiredPopulation' = desiredPopulation,
    _finishing' = if (playing.contains(who) and onlineNow.contains(who)) _finishing.union(Set(who)) else _finishing,
    _offline' = _offline,
    _playingBeforeOffline' = _playingBeforeOffline,
  }

  /// A Synthetic User online now on its daily schedule starts a game.
  action startNextActivity(who: str): bool = all {
    onlineNow.contains(who),
    onSchedule.contains(who),
    not(playing.contains(who)),
    not(_finishing.contains(who)),
    not(_offline.contains(who)),
    onSchedule' = onSchedule,
    onlineNow' = onlineNow,
    playing' = playing.union(Set(who)),
    desiredPopulation' = desiredPopulation,
    _finishing' = _finishing,
    _offline' = _offline,
    _playingBeforeOffline' = _playingBeforeOffline,
  }

  /// Bookkeeping: an ongoing game reaches its multiplayer result; a Synthetic User off its daily schedule then closes the app.
  action _finishGame(who: str): bool = all {
    playing.contains(who),
    not(_offline.contains(who)),
    onSchedule' = onSchedule,
    onlineNow' = if (_finishing.contains(who)) onlineNow.exclude(Set(who)) else onlineNow,
    playing' = playing.exclude(Set(who)),
    desiredPopulation' = desiredPopulation,
    _finishing' = _finishing.exclude(Set(who)),
    _offline' = _offline,
    _playingBeforeOffline' = _playingBeforeOffline,
  }

  /// Bookkeeping: a Synthetic User's device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    onSchedule' = onSchedule,
    onlineNow' = onlineNow,
    playing' = playing,
    desiredPopulation' = desiredPopulation,
    _finishing' = _finishing,
    _offline' = _offline.union(Set(who)),
    _playingBeforeOffline' = playing,
  }

  /// Bookkeeping: that device's connection comes back.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    onSchedule' = onSchedule,
    onlineNow' = onlineNow,
    playing' = playing,
    desiredPopulation' = desiredPopulation,
    _finishing' = _finishing,
    _offline' = _offline.exclude(Set(who)),
    _playingBeforeOffline' = _playingBeforeOffline,
  }

  action step = {
    nondet who = SYNTHETIC_USERS.oneOf()
    any {
      scheduleBegins(who),
      scheduleEnds(who),
      startNextActivity(who),
      _finishGame(who),
      _loseConnection(who),
      _comeBackOnline(who),
    }
  }

  /// Apart from Synthetic Users finishing an ongoing game, no more are online now than the desired synthetic population.
  val invOnlineWithinDesired = onlineNow.size() - _finishing.size() <= desiredPopulation
  /// A Synthetic User off its daily schedule is online now only to finish an ongoing game.
  val invOffScheduleOnlyToFinish = onlineNow.forall(s => onSchedule.contains(s) or (playing.contains(s) and _finishing.contains(s)))
  /// Only a Synthetic User online now plays.
  val invPlayingOnlyOnline = playing.subseteq(onlineNow)
  /// Bookkeeping: a Synthetic User whose device is offline starts no new game.
  val invOfflineStartsNothing = _offline.forall(s => playing.contains(s) implies _playingBeforeOffline.contains(s))
}
