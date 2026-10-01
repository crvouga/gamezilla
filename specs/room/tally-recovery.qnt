// Alice makes two changes and Bob makes one. A change can wait, count before
// its maker hears back, or be heard more than once. The room can become
// unavailable at any point and return; a counted change still counts once.
// Once the room stays available, waiting changes eventually count and their
// makers eventually hear back. Later changes never replace earlier ones.
// This follows three changes. Open apps and offline display are in tally.qnt.
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

  action _update(made: str -> int, counted: Set[str], heard: Set[str], available: bool): bool = all {
    tally' = _sum(counted, made),
    _made' = made, _counted' = counted, _heard' = heard, _available' = available,
  }

  action init = _update(CHANGES.mapBy(_ => 0), Set(), Set(), true)

  /// A person's next change waits until it can reach the shared tally.
  action addOne(person: str, change: str): bool = all {
    person == _maker(change), _made.get(change) == 0,
    _update(_made.set(change, 1), _counted, _heard, _available),
  }

  /// Taking one off is kept in the same way as adding one.
  action takeOne(person: str, change: str): bool = all {
    person == _maker(change), _made.get(change) == 0,
    _update(_made.set(change, -1), _counted, _heard, _available),
  }

  /// A waiting change counts; hearing the same change again counts nothing extra.
  action _changeReachesRoom(change: str): bool = all {
    _available, _made.get(change) != 0,
    _update(_made, _counted.union(Set(change)), _heard, _available),
  }

  /// The room stops being available as a change counts, before its maker hears.
  action _roomStopsAsChangeCounts(change: str): bool = all {
    _available, _made.get(change) != 0,
    _update(_made, _counted.union(Set(change)), _heard, false),
  }

  /// A maker eventually hears that their waiting change counted.
  action _hearBack(change: str): bool = all {
    _available, _counted.contains(change),
    _update(_made, _counted, _heard.union(Set(change)), _available),
  }

  /// Becoming unavailable or returning cannot change an accepted tally.
  action _roomStops = all { _available, _update(_made, _counted, _heard, false) }
  action _roomReturns = all { not(_available), _update(_made, _counted, _heard, true) }
  action _wait = _update(_made, _counted, _heard, _available)

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet change = CHANGES.oneOf()
    any {
      addOne(person, change), takeOne(person, change),
      _changeReachesRoom(change), _roomStopsAsChangeCounts(change), _hearBack(change),
      _roomStops, _roomReturns, _wait,
    }
  }

  /// A counted change always came from its maker's chosen change.
  val invCountedChangesWereMade = _counted.forall(c => _made.get(c) != 0)
  /// Hearing back means the change really counted.
  val invHeardChangesCounted = _heard.subseteq(_counted)
  /// Every change is either waiting or counted once; interruption loses none.
  val invNoChangeLostOrCountedTwice = tally +
    _sum(CHANGES.exclude(_counted), _made) == _sum(CHANGES, _made)
  /// The tally is exactly the changes accepted so far, in any order.
  val invAcceptedTallyAgrees = tally == _sum(_counted, _made)

  val _state = (tally, _made, _counted, _heard, _available)
  temporal _recovery = eventually(always(_available))
  temporal _delivery = CHANGES.forall(c => _changeReachesRoom(c).weakFair(_state))
  temporal _answers = CHANGES.forall(c => _hearBack(c).weakFair(_state))
  /// A waiting change eventually counts when the room can keep being used.
  temporal liveWaitingChangeCounts = (_recovery and _delivery).implies(
    CHANGES.forall(c => (_made.get(c) != 0).leadsTo(_counted.contains(c))))
  /// Someone waiting to hear back eventually learns that their change counted.
  temporal liveMakerHearsBack = (_recovery and _delivery and _answers).implies(
    CHANGES.forall(c => (_made.get(c) != 0).leadsTo(_heard.contains(c))))
}
