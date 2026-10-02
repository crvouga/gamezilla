// People wait, stop, change their range and find a complete match.
//
// Alice, Bob, Carol and Dave can all accept more than one of the others.
// Each has a phone and a computer. Each person has one current wait across
// both devices, and each request and each wait keeps its own outcome.
// Stopping an earlier wait never stops a later one. A matched wait stays
// matched even if its person asks for a new wait.
//
// Earlier compatible waits have the first opportunity. Equal-length waits
// may have either order; this model follows the order their requests were
// accepted. A complete group has the size everyone asked for and every
// person accepts every other. Becoming unavailable ends a waiting wait.
//
// An offline device shows its last known standing and range. It cannot
// begin, stop or change a wait. People may still be matched while away;
// coming back online shows the accepted standing without any further act.
// The example usually uses one chosen group size so its drawn histories
// reach complete groups of three and four. Every size, range, pool and
// fact-change ordering remains possible; this changes sampling only.
module matching {
  type Person = str
  type Device = { person: Person, place: str }
  type Wait = { person: Person, number: int }
  type Standing = NotWaiting | Waiting | Matched(Set[Person])

  pure val PEOPLE = Set("alice", "bob", "carol", "dave")
  pure val PLACES = Set("phone", "computer")
  pure val NUMBERS = Set(1, 2, 3)
  pure val DEVICES = PEOPLE.map(p => PLACES.map(d => { person: p, place: d })).flatten()
  pure val WAITS = PEOPLE.map(p => NUMBERS.map(n => { person: p, number: n })).flatten()
  pure val RATINGS = Map("alice" -> 1000, "bob" -> 1050, "carol" -> 1100, "dave" -> 1150)
  pure val RANGES = Set(5, 50, 200, -1)
  pure val GROUPS = Set(2, 3, 4)
  pure val POOLS = Set("nearby", "elsewhere")
  pure val MATCH_NUMBERS = Set(1, 2, 3, 4, 5, 6)
  pure val TIMES = Set(1, 5, 35, 60)

  type _World = {
    requests: Person -> int, current: Person -> int, receipts: Wait -> int,
    accepted: Set[Wait], waiting: Set[Wait], stopped: Set[Wait],
    assignments: Wait -> int, formIds: Set[int], approved: Wait -> bool,
    changes: Wait -> int, ranges: Wait -> int, sizes: Wait -> int, pools: Wait -> str,
    age: Wait -> int, order: Wait -> int, available: Set[Person], restricted: Set[Set[Person]], count: int
  }

  /// What each device shows about its person's current wait.
  var standing: Device -> Standing
  /// Which of the person's waits the device is showing, or none yet.
  var waitNumber: Device -> int
  /// How far from their rating the device says its person accepts someone.
  var ratingRange: Device -> int
  var _exampleSize: int
  var _requests: Person -> int
  var _current: Person -> int
  var _receipts: Wait -> int
  var _accepted: Set[Wait]
  var _waiting: Set[Wait]
  var _stopped: Set[Wait]
  var _assignments: Wait -> int
  var _formIds: Set[int]
  var _approved: Wait -> bool
  var _changes: Wait -> int
  var _ranges: Wait -> int
  var _sizes: Wait -> int
  var _pools: Wait -> str
  var _age: Wait -> int
  var _order: Wait -> int
  var _available: Set[Person]
  var _restricted: Set[Set[Person]]
  var _count: int
  def _world = { requests: _requests, current: _current, receipts: _receipts, accepted: _accepted, waiting: _waiting, stopped: _stopped, assignments: _assignments, formIds: _formIds, approved: _approved, changes: _changes, ranges: _ranges, sizes: _sizes, pools: _pools, age: _age, order: _order, available: _available, restricted: _restricted, count: _count }
  def _matches = _formIds.map(n => WAITS.filter(a => _assignments.get(a) == n))
  var _offline: Set[Device]
  var _awayStanding: Device -> Standing
  var _awayNumber: Device -> int
  var _awayRange: Device -> int

  pure def _min(a: int, b: int): int = if (a < b) a else b
  pure def _abs(a: int): int = if (a < 0) -a else a
  pure def _wait(w, p) = { person: p, number: w.current.get(p) }
  pure def _range(w, a) =
    if (w.ranges.get(a) == -1) _min(50 + 10 * w.age.get(a), 400)
    else w.ranges.get(a)
  pure def _matchOf(w, a) =
    if (a.number == 0) Set()
    else if (w.assignments.get(a) == 0) Set()
    else WAITS.filter(b => w.assignments.get(b) == w.assignments.get(a))
  pure def _standing(w, p) = {
    val a = _wait(w, p)
    val group = _matchOf(w, a)
    if (group != Set()) Matched(group.filter(b => b != a).map(b => b.person))
    else if (w.waiting.contains(a)) Waiting else NotWaiting
  }
  pure def _shownRange(w, p) =
    if (w.current.get(p) == 0) 5 else _range(w, _wait(w, p))

  action _put(w) = all {
    _requests' = w.requests,
    _current' = w.current,
    _receipts' = w.receipts,
    _accepted' = w.accepted,
    _waiting' = w.waiting,
    _stopped' = w.stopped,
    _assignments' = w.assignments,
    _formIds' = w.formIds,
    _approved' = w.approved,
    _changes' = w.changes,
    _ranges' = w.ranges,
    _sizes' = w.sizes,
    _pools' = w.pools,
    _age' = w.age,
    _order' = w.order,
    _available' = w.available,
    _restricted' = w.restricted,
    _count' = w.count,
  }

  action _show(w, offline) = all {
    _put(w),
    _exampleSize' = _exampleSize,
    _offline' = offline,
    standing' = DEVICES.mapBy(d => if (offline.contains(d)) standing.get(d) else _standing(w, d.person)),
    waitNumber' = DEVICES.mapBy(d => if (offline.contains(d)) waitNumber.get(d) else w.current.get(d.person)),
    ratingRange' = DEVICES.mapBy(d => if (offline.contains(d)) ratingRange.get(d) else _shownRange(w, d.person)),
    _awayStanding' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) standing.get(d) else _awayStanding.get(d)),
    _awayNumber' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) waitNumber.get(d) else _awayNumber.get(d)),
    _awayRange' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) ratingRange.get(d) else _awayRange.get(d)),
  }

  action init = {
    nondet exampleSize = GROUPS.oneOf()
    all {
    _exampleSize' = exampleSize,
    _put({
      requests: PEOPLE.mapBy(_ => 0), current: PEOPLE.mapBy(_ => 0),
      receipts: WAITS.mapBy(_ => 0), accepted: Set(), waiting: Set(),
      stopped: Set(), assignments: WAITS.mapBy(_ => 0),
      formIds: Set(), approved: WAITS.mapBy(_ => false), changes: WAITS.mapBy(_ => 0), ranges: WAITS.mapBy(_ => 5),
      sizes: WAITS.mapBy(_ => 2), pools: WAITS.mapBy(_ => "nearby"),
      age: WAITS.mapBy(_ => 0), order: WAITS.mapBy(_ => 0),
      available: PEOPLE, restricted: Set(), count: 0
    }),
    _offline' = Set(),
    standing' = DEVICES.mapBy(_ => NotWaiting),
    waitNumber' = DEVICES.mapBy(_ => 0),
    ratingRange' = DEVICES.mapBy(_ => 5),
    _awayStanding' = DEVICES.mapBy(_ => NotWaiting),
    _awayNumber' = DEVICES.mapBy(_ => 0),
    _awayRange' = DEVICES.mapBy(_ => 5),
  }

  }

  /// A fresh request starts a wait unless this person is already waiting.
  /// Asking twice, including from another device, never replaces a wait.
  action waitForMatch(device: Device, points: int, groupSize: int, pool: str): bool = {
    val p = device.person
    val n = _world.requests.get(p) + 1
    val request = { person: p, number: n }
    val current = _wait(_world, p)
    val starts = not(_world.waiting.contains(current)) and _world.available.contains(p)
    all {
      n <= 3,
      if (_offline.contains(device)) _show(_world, _offline)
      else _show({ ..._world,
        requests: _world.requests.set(p, n),
        receipts: _world.receipts.set(request, if (starts) n else _world.current.get(p)),
        current: if (starts) _world.current.set(p, n) else _world.current,
        accepted: if (starts) _world.accepted.union(Set(request)) else _world.accepted,
        waiting: if (starts) _world.waiting.union(Set(request)) else _world.waiting,
        ranges: if (starts) _world.ranges.set(request, points) else _world.ranges,
        sizes: if (starts) _world.sizes.set(request, groupSize) else _world.sizes,
        pools: if (starts) _world.pools.set(request, pool) else _world.pools,
        age: if (starts) _world.age.set(request, 0) else _world.age,
        order: if (starts) _world.order.set(request, _world.count + 1) else _world.order,
        count: if (starts) _world.count + 1 else _world.count
      }, _offline)
    }
  }

  /// An earlier request keeps its accepted outcome; it never starts again.
  action repeatRequest(device: Device, number: int): bool = all {
    number <= _world.requests.get(device.person),
    _show(_world, _offline),
  }

  /// Only this exact wait can be stopped; an earlier or matched wait stays as it was.
  action stopWaiting(device: Device, number: int): bool = {
    val a = { person: device.person, number: number }
    val stops = not(_offline.contains(device)) and _world.waiting.contains(a)
    _show({ ..._world,
      waiting: if (stops) _world.waiting.exclude(Set(a)) else _world.waiting,
      stopped: if (stops) _world.stopped.union(Set(a)) else _world.stopped
    }, _offline)
  }

  /// Changing a range counts only for this waiting wait and keeps its age.
  action changeRange(device: Device, number: int, points: int): bool = {
    val a = { person: device.person, number: number }
    val changes = not(_offline.contains(device)) and _world.waiting.contains(a)
    _show({ ..._world, ranges: if (changes) _world.ranges.set(a, points) else _world.ranges,
      changes: if (changes) _world.changes.set(a, _world.changes.get(a) + 1) else _world.changes }, _offline)
  }

  /// Repeating an earlier range change never overwrites a newer choice.
  action repeatRangeChange(device: Device, number: int): bool = all {
    _changes.get({ person: device.person, number: number }) > 0,
    _show(_world, _offline),
  }

  pure def _accept(w, a, b) = and {
    a.person != b.person,
    not(w.restricted.contains(Set(a.person, b.person))),
    w.available.contains(a.person), w.available.contains(b.person),
    w.sizes.get(a) == w.sizes.get(b), w.pools.get(a) == w.pools.get(b),
    _abs(RATINGS.get(a.person) - RATINGS.get(b.person)) <= _range(w, a),
    _abs(RATINGS.get(a.person) - RATINGS.get(b.person)) <= _range(w, b),
  }

  pure def _oldest(order: Wait -> int, waits: Set[Wait]): Wait =
    waits.fold({ person: "none", number: 0 }, (first, a) =>
      if (first.person == "none") a
      else if (order.get(a) < order.get(first)) a else first)
  pure def _earlier(w, a, b) =
    a.contains(_oldest(w.order, a.exclude(b).union(b.exclude(a))))
  pure def _legalGroups(w, waits) = {
    val candidates = PEOPLE.powerset().map(people => people.map(p => _wait(w, p)))
    candidates.filter(g =>
      g.subseteq(waits) and g.size() >= 2 and g.forall(a => w.sizes.get(a) == g.size() and
        g.forall(b => a == b or _accept(w, a, b))))
  }
  pure def _firstChoices(w, waits) = {
    val choices = _legalGroups(w, waits)
    val first = choices.fold(Set(), (earliest, group) =>
      if (earliest == Set()) group
      else if (_earlier(w, group, earliest)) group else earliest)
    Set(first)
  }

  pure def _spare(used: Set[int]): int = MATCH_NUMBERS.exclude(used).fold(0,
    (first, n) => if (first == 0 or n < first) n else first)

  /// Complete compatible groups are formed at once, earliest waits first.
  action pairUp: bool = {
    nondet first = _firstChoices(_world, _world.waiting).oneOf()
    nondet second = _firstChoices(_world, _world.waiting.exclude(first)).oneOf()
    val firstId = _spare(_formIds)
    val afterFirst = if (first == Set()) _formIds else _formIds.union(Set(firstId))
    val secondId = _spare(afterFirst)
    val formed = if (second == Set()) afterFirst else afterFirst.union(Set(secondId))
    all {
      first == Set() or firstId != 0, second == Set() or secondId != 0,
      _show({ ..._world,
        waiting: _world.waiting.exclude(first.union(second)),
        assignments: WAITS.mapBy(a => if (first.contains(a)) firstId
          else if (second.contains(a)) secondId else _assignments.get(a)),
        formIds: formed,
        approved: WAITS.mapBy(a => if (first.contains(a)) first.forall(b => a == b or _accept(_world, a, b))
          else if (second.contains(a)) second.forall(b => a == b or _accept(_world, a, b)) else _approved.get(a))
      }, _offline)
    }
  }

  /// Becoming unavailable ends a wait; a match already made is kept.
  action becomeUnavailable(person: Person): bool = {
    val ended = _world.waiting.filter(a => a.person == person)
    _show({ ..._world, available: _world.available.exclude(Set(person)),
      waiting: _world.waiting.exclude(ended), stopped: _world.stopped.union(ended)
    }, _offline)
  }

  /// Becoming available never brings back an ended wait.
  action becomeAvailable(person: Person): bool =
    _show({ ..._world, available: _world.available.union(Set(person)) }, _offline)

  /// Seconds pass; growing ranges reach 400 points and grow no further.
  action secondsPass(seconds: int): bool =
    _show({ ..._world, age: WAITS.mapBy(a =>
      if (_world.waiting.contains(a)) _min(_world.age.get(a) + seconds, 35)
      else _world.age.get(a)) }, _offline)

  /// These people become unable to match together; existing matches stay.
  action restrictPair(person: Person, other: Person): bool = all {
    person != other,
    _show({ ..._world, restricted: _world.restricted.union(Set(Set(person, other))) }, _offline),
  }

  /// Removing a restriction permits a compatible waiting pair to match.
  action allowPair(person: Person, other: Person): bool = all {
    person != other,
    _show({ ..._world, restricted: _world.restricted.exclude(Set(Set(person, other))) }, _offline),
  }

  /// This device loses its connection and keeps its last known standing.
  action loseConnection(device: Device): bool = all {
    not(_offline.contains(device)),
    _show(_world, _offline.union(Set(device))),
  }

  /// This device returns and shows the accepted outcome without another request.
  action comeBackOnline(device: Device): bool = all {
    _offline.contains(device),
    _show(_world, _offline.exclude(Set(device))),
  }

  action step = {
    nondet anyDevice = DEVICES.oneOf()
    val ready = DEVICES.filter(d => not(_offline.contains(d)) and
      _available.contains(d.person) and _requests.get(d.person) < 3 and
      not(_waiting.contains(_wait(_world, d.person))))
    nondet device = ready.union(Set(anyDevice)).oneOf()
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    nondet _unusual = 0.to(15).oneOf()
    nondet anyPoints = RANGES.oneOf()
    nondet anySize = GROUPS.oneOf()
    nondet anyPool = POOLS.oneOf()
    nondet points = Set(if (_unusual < 3) anyPoints else 200).oneOf()
    nondet groupSize = Set(if (_unusual < 3) anySize else _exampleSize).oneOf()
    nondet pool = Set(if (_unusual < 3) anyPool else "nearby").oneOf()
    nondet number = NUMBERS.oneOf()
    nondet seconds = TIMES.oneOf()
    any {
      waitForMatch(device, points, groupSize, pool), repeatRequest(device, number),
      stopWaiting(device, number), changeRange(device, number, points),
      repeatRangeChange(device, number), pairUp,
      all { _unusual == 0, becomeUnavailable(person) }, becomeAvailable(person), secondsPass(seconds),
      all { _unusual == 0, restrictPair(person, other) }, allowPair(person, other),
      loseConnection(device), comeBackOnline(device),
    }
  }

  /// A person never has two waiting waits, even across devices.
  val invOneWait = PEOPLE.forall(p => _world.waiting.filter(a => a.person == p).size() <= 1)
  /// One wait appears in at most one complete match.
  val invExactlyOneAssignment = WAITS.forall(a => _matches.filter(g => g.contains(a)).size() <= 1)
  /// Every match has precisely the distinct people each wait asked for.
  val invCompleteGroups = _matches.forall(g =>
    g.size() >= 2 and g.map(a => a.person).size() == g.size() and
    g.forall(a => _world.sizes.get(a) == g.size()))
  /// People in a match agree on its matching pool and accept each other's ratings.
  val invMutualRanges = _matches.forall(g => g.forall(a => g.forall(b =>
    _world.pools.get(a) == _world.pools.get(b) and
    _abs(RATINGS.get(a.person) - RATINGS.get(b.person)) <= _range(_world, a))))
  /// Every formed match was approved by each person when it was formed.
  val invFormationApproved = _matches.flatten().forall(a => _approved.get(a))
  /// Every formed match keeps its complete group; no accepted outcome disappears.
  val invLastingAssignments = _matches.size() == _formIds.size()
  /// Stopped and matched waits cannot be used again.
  val invTerminalWaits = and {
    _world.waiting.intersect(_world.stopped) == Set(),
    _world.waiting.intersect(_matches.flatten()) == Set(),
    _world.stopped.intersect(_matches.flatten()) == Set(),
  }
  /// Only accepted waits may be waiting, stopped or matched.
  val invAcknowledgedOutcomes =
    _world.waiting.union(_world.stopped).union(_matches.flatten()) == _world.accepted
  /// No wait remains waiting for someone who is unavailable.
  val invAvailableWaits = _world.waiting.forall(a => _world.available.contains(a.person))
  /// Online devices agree with the accepted standing, wait and range.
  val invReturningAgrees = DEVICES.forall(d => not(_offline.contains(d)) implies and {
    standing.get(d) == _standing(_world, d.person),
    waitNumber.get(d) == _world.current.get(d.person),
    ratingRange.get(d) == _shownRange(_world, d.person),
  })
  /// An offline device keeps its last known wait until its connection returns.
  val invOfflineKeepsKnown = DEVICES.forall(d => _offline.contains(d) implies and {
    standing.get(d) == _awayStanding.get(d),
    waitNumber.get(d) == _awayNumber.get(d),
    ratingRange.get(d) == _awayRange.get(d),
  })
  /// Growing ranges stay between 50 and 400 points, including both boundaries.
  val invGrowingBoundaries = _world.accepted.forall(a =>
    _world.ranges.get(a) == -1 implies (_range(_world, a) >= 50 and _range(_world, a) <= 400))
  /// Bookkeeping: the finite example admits three requests per person.
  val invRequestBounds = PEOPLE.forall(p =>
    _world.requests.get(p) >= 0 and _world.requests.get(p) <= 3 and
    _world.current.get(p) >= 0 and _world.current.get(p) <= _world.requests.get(p))
  val _wellFormed = and {
    _world.accepted.subseteq(WAITS), _world.waiting.subseteq(WAITS),
    _world.stopped.subseteq(WAITS), _matches.flatten().subseteq(WAITS),
    _world.available.subseteq(PEOPLE), _offline.subseteq(DEVICES),
    PEOPLE.forall(p => and {
      _world.current.get(p) >= 0, _world.current.get(p) <= _world.requests.get(p),
      _world.current.get(p) != 0 implies _world.accepted.contains(_wait(_world, p)),
    }),
    WAITS.map(a => _assignments.get(a)).exclude(Set(0)) == _formIds,
    _world.accepted.forall(a => and {
      _world.order.get(a) > 0, _world.order.get(a) <= _world.count,
      _world.accepted.forall(b => a == b or _world.order.get(a) != _world.order.get(b)),
    }),
    _world.waiting.forall(a => _wait(_world, a.person) == a),
    WAITS.forall(a => and {
      RANGES.contains(_world.ranges.get(a)), GROUPS.contains(_world.sizes.get(a)),
      POOLS.contains(_world.pools.get(a)), _world.age.get(a) >= 0, _world.age.get(a) <= 35,
      _world.accepted.contains(a) implies a.number <= _world.requests.get(a.person),
    }),
  }
  pure val _possibleRestrictions = tuples(PEOPLE, PEOPLE).map(t => Set(t._1, t._2)).filter(g => g.size() == 2)
  pure val _standings = Set(NotWaiting, Waiting).union(PEOPLE.powerset().map(g => Matched(g)))
  val _proof = all {
    _exampleSize.in(GROUPS),
    _requests.in(PEOPLE.setOfMaps(Set(0, 1, 2, 3))),
    _current.in(PEOPLE.setOfMaps(Set(0, 1, 2, 3))),
    _receipts.in(WAITS.setOfMaps(Set(0, 1, 2, 3))),
    _accepted.in(WAITS.powerset()),
    _waiting.in(WAITS.powerset()),
    _stopped.in(WAITS.powerset()),
    _assignments.in(WAITS.setOfMaps(Set(0, 1, 2, 3, 4, 5, 6))),
    _formIds.in(MATCH_NUMBERS.powerset()),
    _approved.in(WAITS.setOfMaps(Set(true, false))),
    _changes.in(WAITS.setOfMaps(Nat)),
    _ranges.in(WAITS.setOfMaps(RANGES)),
    _sizes.in(WAITS.setOfMaps(GROUPS)),
    _pools.in(WAITS.setOfMaps(POOLS)),
    _age.in(WAITS.setOfMaps(0.to(35))),
    _order.in(WAITS.setOfMaps(Nat)),
    _available.in(PEOPLE.powerset()),
    _restricted.in(_possibleRestrictions.powerset()),
    _count.in(Nat),
    _offline.in(DEVICES.powerset()),
    _awayStanding.in(DEVICES.setOfMaps(_standings)),
    _awayNumber.in(DEVICES.setOfMaps(Set(0, 1, 2, 3))),
    _awayRange.in(DEVICES.setOfMaps(Nat)),
    standing.in(DEVICES.setOfMaps(_standings)),
    waitNumber.in(DEVICES.setOfMaps(Set(0, 1, 2, 3))),
    ratingRange.in(DEVICES.setOfMaps(Nat)),

    _wellFormed, invFormationApproved, invLastingAssignments, invOneWait, invExactlyOneAssignment, invCompleteGroups,
    invMutualRanges, invTerminalWaits, invAcknowledgedOutcomes,
    invAvailableWaits, invReturningAgrees, invOfflineKeepsKnown,
    invGrowingBoundaries, invRequestBounds,
  }

}
