// Owning a game room, with Alice, Bob and Eve in it.
//
// Nobody owns the room at first. The first person to claim it becomes its
// owner, and nobody can take it from them afterwards. The owner can turn
// anyone else away; nobody else can, and the owner cannot turn themselves
// away. Someone who is turned away cannot change anything in the room: a
// claim or a change to the tally from them is refused. Everyone else's
// changes to the tally still count. Someone with no connection cannot claim
// the room, turn anyone away or change the tally.
module ownership {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "eve")

  /// The room's owner, or "" while nobody owns it.
  var owner: str
  /// Everyone the owner has turned away.
  var turnedAway: Set[Person]
  /// The tally everyone sees.
  var tally: int
  /// People whose phone has no connection.
  var _offline: Set[Person]
  /// How many times each person has claimed, turned someone away or added
  /// one, and how many when their connection went.
  var _done: Person -> int
  var _doneAtCutOff: Person -> int

  action _update(
    newOwner: str,
    newTurnedAway: Set[Person],
    newTally: int,
    newOffline: Set[Person],
    newDone: Person -> int,
    newCutOff: Person -> int,
  ): bool = all {
    owner' = newOwner,
    turnedAway' = newTurnedAway,
    tally' = newTally,
    _offline' = newOffline,
    _done' = newDone,
    _doneAtCutOff' = newCutOff,
  }

  def _acted(person: Person): Person -> int =
    _done.set(person, _done.get(person) + 1)

  action init = _update("", Set(), 0, Set(), PEOPLE.mapBy(_ => 0), PEOPLE.mapBy(_ => 0))

  /// `person` claims the room; only a room nobody owns can be claimed.
  action claim(person: Person): bool = all {
    not(_offline.contains(person)),
    if (owner == "" and not(turnedAway.contains(person)))
      _update(person, turnedAway, tally, _offline, _acted(person), _doneAtCutOff)
    else
      _update(owner, turnedAway, tally, _offline, _acted(person), _doneAtCutOff),
  }

  /// `person` turns `other` away; only the owner can, and not themselves.
  action turnAway(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    if (person == owner and other != owner)
      _update(owner, turnedAway.union(Set(other)), tally, _offline, _acted(person), _doneAtCutOff)
    else
      _update(owner, turnedAway, tally, _offline, _acted(person), _doneAtCutOff),
  }

  /// `person` adds one to the tally; nothing changes if they are turned away.
  action addOne(person: Person): bool = all {
    not(_offline.contains(person)),
    if (not(turnedAway.contains(person)))
      _update(owner, turnedAway, tally + 1, _offline, _acted(person), _doneAtCutOff)
    else
      _update(owner, turnedAway, tally, _offline, _acted(person), _doneAtCutOff),
  }

  /// `person`'s phone loses its connection.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _update(
      owner, turnedAway, tally, _offline.union(Set(person)), _done,
      _doneAtCutOff.set(person, _done.get(person)),
    ),
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    _update(owner, turnedAway, tally, Set(), _done, _doneAtCutOff),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    any {
      claim(person),
      turnAway(person, other),
      addOne(person),
      _loseConnection(person),
      _connectionReturns,
    }
  }

  /// The owner is never turned away.
  val invOwnerNeverTurnedAway = not(turnedAway.contains(owner))

  /// Only a room with an owner has anyone turned away.
  val invTurnedAwayOnlyByAnOwner = turnedAway != Set() implies owner != ""

  /// The tally never goes backwards past where it started.
  val invTallyNotNegative = tally >= 0

  /// With no connection, a person claims, turns people away and adds to the
  /// tally no further time.
  val invOfflineDoesNoMore = PEOPLE.forall(p =>
    _offline.contains(p) implies _done.get(p) == _doneAtCutOff.get(p)
  )
}
