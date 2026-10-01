// A host and two people are together in one space. Each person may lose
// their connection and return independently. People may leave; the host
// may end the space or leave it. Losing a connection never ends the space.
// With their connections back, people find everyone still there once, or
// learn that the space ended. This model follows one space through its end.
module space_recovery {
  type Person = str
  type RecoveryWhereabouts = InSpace | Left | Ended
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val HOST = "alice"

  /// The space is open until its host ends it or leaves.
  var openSpaces: Set[Person]
  /// Where each person sees themself, including their last known space while away.
  var whereabouts: Person -> RecoveryWhereabouts
  /// Each person's view of who is present, unavailable while away.
  var presence: Person -> int
  var _whereabouts: Person -> RecoveryWhereabouts
  var _online: Person -> bool

  action _update(where: Person -> RecoveryWhereabouts, connected: Person -> bool, open: Set[Person]): bool = all {
    _whereabouts' = where,
    _online' = connected,
    openSpaces' = open,
    whereabouts' = PEOPLE.mapBy(p => if (connected.get(p)) where.get(p) else whereabouts.get(p)),
    presence' = PEOPLE.mapBy(p =>
      if (connected.get(p) and where.get(p) == InSpace)
        PEOPLE.filter(q => connected.get(q) and where.get(q) == InSpace).size()
      else 0),
  }

  action init = all {
    openSpaces' = Set(HOST),
    whereabouts' = PEOPLE.mapBy(_ => InSpace),
    presence' = PEOPLE.mapBy(_ => PEOPLE.size()),
    _whereabouts' = PEOPLE.mapBy(_ => InSpace),
    _online' = PEOPLE.mapBy(_ => true),
  }

  /// Someone leaves for good, without ending the host's space.
  action leave(person: Person): bool = all {
    person != HOST, _online.get(person), _whereabouts.get(person) == InSpace,
    _update(_whereabouts.set(person, Left), _online, openSpaces),
  }

  /// The host ends the space for everyone, including people who are away.
  action endSpace: bool = all {
    _online.get(HOST), openSpaces.contains(HOST),
    _update(PEOPLE.mapBy(_ => Ended), _online, Set()),
  }

  /// Leaving as host shows the ended space to everyone who was still in it.
  action leaveHost: bool = all {
    _online.get(HOST), openSpaces.contains(HOST),
    _update(PEOPLE.mapBy(_ => Ended), _online, Set()),
  }

  /// Losing the connection stops showing a person as present, without leaving.
  action _loseConnection(person: Person): bool = all {
    _online.get(person),
    _update(_whereabouts, _online.set(person, false), openSpaces),
  }

  /// The person's own connection returns and shows every change made while away.
  action _connectionReturns(person: Person): bool = all {
    not(_online.get(person)),
    _update(_whereabouts, _online.set(person, true), openSpaces),
  }

  /// People may wait without changing their space.
  action _wait = _update(_whereabouts, _online, openSpaces)

  action step = {
    nondet person = PEOPLE.oneOf()
    any { leave(person), endSpace, leaveHost, _loseConnection(person), _connectionReturns(person), _wait }
  }

  /// Nobody remains in a space after it has ended.
  val invEndedHasNobodyInside = openSpaces == Set() implies PEOPLE.forall(p => _whereabouts.get(p) != InSpace)

  /// Someone leaving never takes the host's open space away.
  val invOpenHasItsHost = openSpaces.contains(HOST) implies _whereabouts.get(HOST) == InSpace

  /// Connected people know whether they are still in the space or it has ended.
  val invConnectedPeopleKnow = PEOPLE.forall(p => _online.get(p) implies whereabouts.get(p) == _whereabouts.get(p))

  /// Connected people still in the space count every connected person once.
  val invPresenceIsCurrent = PEOPLE.forall(p => presence.get(p) ==
    (if (_online.get(p) and _whereabouts.get(p) == InSpace)
      PEOPLE.filter(q => _online.get(q) and _whereabouts.get(q) == InSpace).size() else 0))

  val _state = (openSpaces, whereabouts, presence, _whereabouts, _online)
  temporal _connectionsStay = eventually(always(PEOPLE.forall(p => _online.get(p))))

  /// Someone away at the end eventually learns the space ended once back.
  temporal liveNobodyMissesTheEnd = _connectionsStay.implies(PEOPLE.forall(p =>
    (_whereabouts.get(p) == Ended).leadsTo(whereabouts.get(p) == Ended)))

  /// With connections back, everyone eventually keeps seeing the current space.
  temporal liveEveryoneKeepsAgreeing = _connectionsStay.implies(
    eventually(always(PEOPLE.forall(p => whereabouts.get(p) == _whereabouts.get(p)))))
}
