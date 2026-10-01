// Alice makes two changes and Bob makes one. A change can wait, count before
// its maker hears back, or be heard more than once. The room can become
// unavailable at any point and return; a counted change still counts once.
// Once the room stays available, waiting changes eventually count and their
// makers eventually hear back. Later changes never replace earlier ones.
// This follows three changes. Separate promises cover open apps and what
// they show while offline.
// Alice and Bob can independently lose their connections; an offline change
// still waits and counts when its maker has a connection again.
module tally_recovery {
  pure val PEOPLE = Set("alice", "bob")
  pure val CHANGES = Set("alice-one", "alice-two", "bob-one")
  pure def _maker(change: str): str = if (change == "bob-one") "bob" else "alice"
  pure def _sum(changes: Set[str], values: str -> int): int =
    changes.fold(0, (n, c) => n + values.get(c))

  /// The shared tally keeps each counted change once, even after an interruption.
  var tally: int
  var _made: str -> int
  var _counted: Set[str]
  var _heard: Set[str]
  var _available: bool
  var _online: str -> bool

  action _update(made: str -> int, counted: Set[str], heard: Set[str], available: bool, online: str -> bool): bool = all {
    tally' = _sum(counted, made),
    _made' = made, _counted' = counted, _heard' = heard, _available' = available,
    _online' = online,
  }

  action init = all {
    tally' = 0, _made' = CHANGES.mapBy(_ => 0),
    _counted' = Set(), _heard' = Set(), _available' = true,
    _online' = PEOPLE.mapBy(_ => true),
  }

  /// A person's next change waits until it can reach the shared tally.
  action addOne(person: str, change: str): bool = all {
    person == _maker(change), _made.get(change) == 0,
    _update(_made.set(change, 1), _counted, _heard, _available, _online),
  }

  /// Taking one off is kept in the same way as adding one.
  action takeOne(person: str, change: str): bool = all {
    person == _maker(change), _made.get(change) == 0,
    _update(_made.set(change, -1), _counted, _heard, _available, _online),
  }

  /// A waiting change counts; hearing the same change again counts nothing extra.
  action _changeReachesRoom(change: str): bool = all {
    _available, _online.get(_maker(change)), _made.get(change) != 0,
    _update(_made, _counted.union(Set(change)), _heard, _available, _online),
  }

  /// The room stops being available as a change counts, before its maker hears.
  action _roomStopsAsChangeCounts(change: str): bool = all {
    _available, _online.get(_maker(change)), _made.get(change) != 0,
    _update(_made, _counted.union(Set(change)), _heard, false, _online),
  }

  /// A maker eventually hears that their waiting change counted.
  action _hearBack(change: str): bool = all {
    _available, _online.get(_maker(change)), _counted.contains(change),
    _update(_made, _counted, _heard.union(Set(change)), _available, _online),
  }

  /// Becoming unavailable or returning cannot change an accepted tally.
  action _roomStops = all { _available, _update(_made, _counted, _heard, false, _online) }
  action _roomReturns = all { not(_available), _update(_made, _counted, _heard, true, _online) }
  action _loseConnection(person: str): bool = all {
    _online.get(person), _update(_made, _counted, _heard, _available, _online.set(person, false)),
  }
  action _connectionReturns(person: str): bool = all {
    not(_online.get(person)), _update(_made, _counted, _heard, _available, _online.set(person, true)),
  }
  action _wait = _update(_made, _counted, _heard, _available, _online)

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet change = CHANGES.oneOf()
    any {
      addOne(person, change), takeOne(person, change),
      _changeReachesRoom(change), _roomStopsAsChangeCounts(change), _hearBack(change),
      _roomStops, _roomReturns, _loseConnection(person), _connectionReturns(person), _wait,
    }
  }

  /// A counted change always came from its maker's chosen change.
  val invCountedChangesWereMade = _counted.forall(c => _made.get(c) != 0)
  /// Hearing back means the change really counted.
  val invHeardChangesCounted = _heard.forall(c => _counted.contains(c))
  /// Every change is either waiting or counted once; interruption loses none.
  val invNoChangeLostOrCountedTwice = tally +
    _sum(CHANGES.filter(c => not(_counted.contains(c))), _made) == _sum(CHANGES, _made)
  /// The tally is exactly the changes accepted so far, in any order.
  val invAcceptedTallyAgrees = tally == _sum(_counted, _made)
  /// Disconnecting cannot take away a change the maker already heard counted.
  val invDisconnectedMakerKeepsCountedChange = PEOPLE.forall(p =>
    not(_online.get(p)) implies _heard.filter(c => _maker(c) == p).forall(c => _counted.contains(c)))

  val _state = (tally, _made, _counted, _heard, _available, _online)
  temporal _recovery = eventually(always(_available and PEOPLE.forall(p => _online.get(p))))
  temporal _delivery = CHANGES.forall(c => _changeReachesRoom(c).weakFair(_state))
  temporal _answers = CHANGES.forall(c => _hearBack(c).weakFair(_state))
  /// A waiting change eventually counts when the room can keep being used.
  temporal liveWaitingChangeCounts = (_recovery and _delivery).implies(
    CHANGES.forall(c => (_made.get(c) != 0).leadsTo(_counted.contains(c))))
  /// Someone waiting to hear back eventually learns that their change counted.
  temporal liveMakerHearsBack = (_recovery and _delivery and _answers).implies(
    CHANGES.forall(c => (_made.get(c) != 0).leadsTo(_heard.contains(c))))
}
