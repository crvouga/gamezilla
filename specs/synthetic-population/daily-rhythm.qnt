// Cedar, Maple and Birch are Synthetic Users, each with its own daily
// schedule. When its daily schedule begins, a Synthetic User comes online now,
// unless as many Synthetic Users as the desired synthetic population already
// are; then it is kept away. A place never stays free while a Synthetic User
// on its daily schedule is kept away: the moment one frees up, the Synthetic
// User kept away longest comes online now. When its daily schedule ends a
// Synthetic User is no longer online now, except that one in an ongoing game
// finishes that game first and starts nothing new. Apart from Synthetic Users
// finishing an ongoing game, no more Synthetic Users are online now than the
// desired synthetic population.
// With no connection, a Synthetic User starts no new activity and is passed
// over for a free place; once its connection returns it carries on, and if a
// place is free and it has been kept away longest, it comes online now.
module daily_rhythm {
  /// The Synthetic Users whose daily schedule says they tend to be online now.
  var onSchedule: Set[str]
  /// The Synthetic Users online now.
  var onlineNow: Set[str]
  /// The Synthetic Users on their daily schedule kept away while the desired synthetic population is online now, longest first.
  var keptAway: List[str]
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

  /// Bookkeeping: whether a place is free.
  pure def _room(online: Set[str], finishing: Set[str], desired: int): bool =
    online.size() - finishing.size() < desired

  /// Bookkeeping: the connected Synthetic User kept away longest, or "" for none.
  pure def _firstWaiting(kept: List[str], offline: Set[str]): str =
    kept.foldl("", (acc, s) => if (acc == "" and not(offline.contains(s))) s else acc)

  /// Bookkeeping: who is online now once a free place goes to the one kept away longest.
  pure def _fillOnline(online: Set[str], finishing: Set[str], kept: List[str], offline: Set[str], desired: int): Set[str] =
    if (_room(online, finishing, desired) and _firstWaiting(kept, offline) != "")
      online.union(Set(_firstWaiting(kept, offline)))
    else online

  /// Bookkeeping: who is still kept away once a free place goes to the one kept away longest.
  pure def _fillKept(online: Set[str], finishing: Set[str], kept: List[str], offline: Set[str], desired: int): List[str] =
    if (_room(online, finishing, desired) and _firstWaiting(kept, offline) != "")
      kept.select(s => s != _firstWaiting(kept, offline))
    else kept

  pure def _asSet(kept: List[str]): Set[str] =
    kept.foldl(Set(), (acc, s) => acc.union(Set(s)))

  action init = {
    nondet desired = 0.to(3).oneOf()
    all {
      onSchedule' = Set(),
      onlineNow' = Set(),
      keptAway' = List(),
      playing' = Set(),
      desiredPopulation' = desired,
      _finishing' = Set(),
      _offline' = Set(),
      _playingBeforeOffline' = Set(),
    }
  }

  /// A Synthetic User's daily schedule begins in its home region: it comes online now if a place is free, or else is kept away.
  action scheduleBegins(who: str): bool = {
    val room = _room(onlineNow, _finishing, desiredPopulation)
    val alreadyOnline = onlineNow.contains(who)
    val comesOnline = not(alreadyOnline) and not(_offline.contains(who)) and room
    val online0 = if (comesOnline) onlineNow.union(Set(who)) else onlineNow
    val finishing0 = if (alreadyOnline and room) _finishing.exclude(Set(who)) else _finishing
    val kept0 = if (alreadyOnline or comesOnline) keptAway else keptAway.append(who)
    all {
      not(onSchedule.contains(who)),
      onSchedule' = onSchedule.union(Set(who)),
      onlineNow' = _fillOnline(online0, finishing0, kept0, _offline, desiredPopulation),
      keptAway' = _fillKept(online0, finishing0, kept0, _offline, desiredPopulation),
      playing' = playing,
      desiredPopulation' = desiredPopulation,
      _finishing' = finishing0,
      _offline' = _offline,
      _playingBeforeOffline' = _playingBeforeOffline,
    }
  }

  /// A Synthetic User's daily schedule ends; it finishes an ongoing game first. A place it frees goes at once to the one kept away longest.
  action scheduleEnds(who: str): bool = {
    val online0 = if (playing.contains(who)) onlineNow else onlineNow.exclude(Set(who))
    val finishing0 = if (playing.contains(who) and onlineNow.contains(who)) _finishing.union(Set(who)) else _finishing
    val kept0 = keptAway.select(s => s != who)
    all {
      onSchedule.contains(who),
      onSchedule' = onSchedule.exclude(Set(who)),
      onlineNow' = _fillOnline(online0, finishing0, kept0, _offline, desiredPopulation),
      keptAway' = _fillKept(online0, finishing0, kept0, _offline, desiredPopulation),
      playing' = playing,
      desiredPopulation' = desiredPopulation,
      _finishing' = finishing0,
      _offline' = _offline,
      _playingBeforeOffline' = _playingBeforeOffline,
    }
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
    keptAway' = keptAway,
    playing' = playing.union(Set(who)),
    desiredPopulation' = desiredPopulation,
    _finishing' = _finishing,
    _offline' = _offline,
    _playingBeforeOffline' = _playingBeforeOffline,
  }

  /// Bookkeeping: an ongoing game reaches its multiplayer result; a Synthetic User off its daily schedule then closes the app, and its place goes at once to the one kept away longest.
  action _finishGame(who: str): bool = {
    val online0 = if (_finishing.contains(who)) onlineNow.exclude(Set(who)) else onlineNow
    val finishing0 = _finishing.exclude(Set(who))
    val kept0 = if (_finishing.contains(who) and onSchedule.contains(who)) keptAway.append(who) else keptAway
    all {
      playing.contains(who),
      not(_offline.contains(who)),
      onSchedule' = onSchedule,
      onlineNow' = _fillOnline(online0, finishing0, kept0, _offline, desiredPopulation),
      keptAway' = _fillKept(online0, finishing0, kept0, _offline, desiredPopulation),
      playing' = playing.exclude(Set(who)),
      desiredPopulation' = desiredPopulation,
      _finishing' = finishing0,
      _offline' = _offline,
      _playingBeforeOffline' = _playingBeforeOffline,
    }
  }

  /// Bookkeeping: a Synthetic User's device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    onSchedule' = onSchedule,
    onlineNow' = onlineNow,
    keptAway' = keptAway,
    playing' = playing,
    desiredPopulation' = desiredPopulation,
    _finishing' = _finishing,
    _offline' = _offline.union(Set(who)),
    _playingBeforeOffline' = playing,
  }

  /// Bookkeeping: that device's connection comes back; a free place goes at once to the one kept away longest.
  action _comeBackOnline(who: str): bool = {
    val offline0 = _offline.exclude(Set(who))
    all {
      _offline.contains(who),
      onSchedule' = onSchedule,
      onlineNow' = _fillOnline(onlineNow, _finishing, keptAway, offline0, desiredPopulation),
      keptAway' = _fillKept(onlineNow, _finishing, keptAway, offline0, desiredPopulation),
      playing' = playing,
      desiredPopulation' = desiredPopulation,
      _finishing' = _finishing,
      _offline' = offline0,
      _playingBeforeOffline' = _playingBeforeOffline,
    }
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
  /// A place never stays free while a connected Synthetic User on its daily schedule is kept away.
  val invNoFreePlaceWhileKeptAway = not(_room(onlineNow, _finishing, desiredPopulation) and _firstWaiting(keptAway, _offline) != "")
  /// Those kept away are on their daily schedule, not online now, and each is kept away once.
  val invKeptAwayOnSchedule = _asSet(keptAway).forall(s => onSchedule.contains(s) and not(onlineNow.contains(s))) and keptAway.length() == _asSet(keptAway).size()
  /// Every Synthetic User on its daily schedule is online now or kept away.
  val invOnScheduleOnlineOrKeptAway = onSchedule.forall(s => onlineNow.contains(s) or _asSet(keptAway).contains(s))
  /// A Synthetic User off its daily schedule is online now only to finish an ongoing game.
  val invOffScheduleOnlyToFinish = onlineNow.forall(s => onSchedule.contains(s) or (playing.contains(s) and _finishing.contains(s)))
  /// Only a Synthetic User online now plays.
  val invPlayingOnlyOnline = playing.subseteq(onlineNow)
  /// Bookkeeping: a Synthetic User whose device is offline starts no new game.
  val invOfflineStartsNothing = _offline.forall(s => playing.contains(s) implies _playingBeforeOffline.contains(s))
}
