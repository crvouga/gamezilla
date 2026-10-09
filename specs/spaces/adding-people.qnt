// Alice hosts a space and adds Bob, who is signed in and is not her friend.
// Adding gives Bob a place in his lobby, never participation. Bob chooses
// Join from the lobby or public link. The host keeps additions made offline;
// Bob learns them when both connections are available. Removing Bob takes
// away added access and ends any participation, but the public link still
// permits another explicit Join. The host uses Leave to end the space.
// Offline choices stay with the host until shared. A connected person can
// still learn an end that was shared before the host went offline.
module adding_people {
  type Person = str
  pure val PEOPLE = Set("alice", "bob")
  type Whereabouts = Lobby | InSpace | Left | Ended | DroppedOut
  var whereabouts: Person -> Whereabouts
  var lobby: Person -> Set[Person]
  var _open: bool
  var _added: bool
  var _joined: bool
  var _atLink: bool
  var _offline: Set[Person]
  var _knownAdded: bool
  var _knownOpen: bool
  var _knownJoined: bool
  var _sharedOpen: bool
  var _sharedAdded: bool
  var _sharedJoined: bool

  pure def _show(open: bool, joined: bool, atLink: bool, away: Set[Person]): Person -> Whereabouts =
    Map("alice" -> (if (open) InSpace else Ended),
      "bob" -> (if (joined and open)
        (if (away == Set()) InSpace else DroppedOut)
        else if (atLink) (if (open) Left else Ended) else Lobby))

  action _choose(open: bool, added: bool, joined: bool, atLink: bool, away: Set[Person]): bool = {
    val sharedOpen = if (away.contains("alice")) _sharedOpen else open
    val sharedAdded = if (away.contains("alice")) _sharedAdded else added
    val sharedJoined = if (away.contains("alice")) _sharedJoined else joined
    val known = if (away.contains("bob")) _knownAdded else sharedAdded
    val knowsSpace = sharedAdded or atLink or _knownAdded or _atLink
    val knownOpen = if (not(away.contains("bob")) and knowsSpace) sharedOpen else _knownOpen
    val knownJoined = if (away.contains("bob")) _knownJoined else sharedJoined
    val place = _show(knownOpen, knownJoined, atLink, away).set("alice", if (open) InSpace else Ended)
    all {
      _open' = open, _added' = added, _joined' = joined,
      _atLink' = atLink, _offline' = away, _knownAdded' = known, _knownOpen' = knownOpen,
      _knownJoined' = knownJoined,
      _sharedOpen' = sharedOpen, _sharedAdded' = sharedAdded, _sharedJoined' = sharedJoined,
      whereabouts' = place,
      lobby' = Map("alice" -> Set(), "bob" ->
        (if (place.get("bob") == Lobby and knownOpen and known) Set("alice") else Set())),
    }
  }

  action init = all {
    _open' = true, _added' = false, _joined' = false,
    _atLink' = false, _offline' = Set(), _knownAdded' = false, _knownOpen' = true,
    _knownJoined' = false,
    _sharedOpen' = true, _sharedAdded' = false, _sharedJoined' = false,
    whereabouts' = Map("alice" -> InSpace, "bob" -> Lobby),
    lobby' = PEOPLE.mapBy(_ => Set()),
  }

  /// The host grants access without joining the person.
  action addPerson: bool = all {
    _open, not(_added),
    _choose(_open, true, _joined, _atLink, _offline),
  }

  /// The host removes added access and any current participation.
  action removePerson: bool = all {
    _open, _added or _joined,
    _choose(_open, false, false, _atLink or _joined, _offline),
  }

  /// Bob follows the public link without joining by opening it.
  action openSpaceLink: bool = all {
    not(_joined),
    _choose(_open, _added, _joined, true, _offline),
  }

  /// Bob explicitly chooses Join; added access is not required by a public link.
  action join: bool = all {
    _open, not(_joined), _offline == Set(),
    _knownAdded or _atLink,
    _choose(_open, true, true, true, _offline),
  }

  /// The host's Leave ends the space for everyone.
  action leaveHost: bool = all {
    _open,
    _choose(false, _added, false, _atLink or _joined, _offline),
  }

  action loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _choose(_open, _added, _joined, _atLink, _offline.union(Set(person))),
  }

  action connectionReturns: bool = all {
    _offline != Set(),
    _choose(_open, _added, _joined, _atLink, Set()),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    any { addPerson, removePerson, openSpaceLink, join, leaveHost,
      loseConnection(person), connectionReturns }
  }

  /// Adding alone never makes Bob a participant.
  val invAdditionNeverJoins = not(_joined) implies whereabouts.get("bob") != InSpace
  /// Connected lobby access reflects the host's current addition.
  val invLobbyAccessIsCurrent = _offline == Set() implies
    lobby.get("bob") == (if (_open and _added and whereabouts.get("bob") == Lobby) Set("alice") else Set())
  /// An offline host retains their own open space.
  val invOfflineHostKeepsSpace = _open implies whereabouts.get("alice") == InSpace
  /// Bob is disconnected while either person is offline.
  val invHostConnectionControlsParticipation = _joined and _offline != Set() implies whereabouts.get("bob") == DroppedOut
  /// The host's Leave leaves no participant in an ended space.
  val invEndedSpaceHasNoParticipant = not(_open) implies
    whereabouts.get("alice") == Ended and whereabouts.get("bob") != InSpace

  val _inductive = and {
    _offline.subseteq(PEOPLE),
    whereabouts == _show(_knownOpen, _knownJoined, _atLink, _offline).set("alice", if (_open) InSpace else Ended),
    not(_open) implies not(_joined),
    _offline == Set() implies _knownAdded == _added,
    not(_offline.contains("alice")) implies
      _sharedOpen == _open and _sharedAdded == _added and _sharedJoined == _joined,
    not(_offline.contains("bob")) implies
      _knownAdded == _sharedAdded and _knownJoined == _sharedJoined,
    not(_offline.contains("bob")) and (_knownAdded or _atLink) implies _knownOpen == _sharedOpen,
    _offline == Set() implies _knownJoined == _joined,
    lobby == Map("alice" -> Set(), "bob" ->
      (if (whereabouts.get("bob") == Lobby and _knownOpen and _knownAdded) Set("alice") else Set())),
    invAdditionNeverJoins, invLobbyAccessIsCurrent, invOfflineHostKeepsSpace,
    invHostConnectionControlsParticipation, invEndedSpaceHasNoParticipant,
  }
}
