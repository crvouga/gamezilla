// Owning a game room, with Alice, Bob and Eve in it.
//
// Nobody owns the room at first. The first person to claim it becomes its
// owner, and nobody can take it from them afterwards. The owner can turn
// anyone else away; nobody else can, and the owner cannot turn themselves
// away. Someone who is turned away cannot change anything in the room: a
// claim or a change to the tally from them is refused. Everyone else's
// changes to the tally still count.
module ownership {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "eve")

  /// The room's owner, or "" while nobody owns it.
  var owner: str
  /// Everyone the owner has turned away.
  var turnedAway: Set[Person]
  /// The tally everyone sees.
  var tally: int

  action _update(newOwner: str, newTurnedAway: Set[Person], newTally: int): bool = all {
    owner' = newOwner,
    turnedAway' = newTurnedAway,
    tally' = newTally,
  }

  action _unchanged: bool = _update(owner, turnedAway, tally)

  action init = _update("", Set(), 0)

  /// `person` claims the room; only a room nobody owns can be claimed.
  action claim(person: Person): bool =
    if (owner == "" and not(turnedAway.contains(person)))
      _update(person, turnedAway, tally)
    else _unchanged

  /// `person` turns `other` away; only the owner can, and not themselves.
  action turnAway(person: Person, other: Person): bool =
    if (person == owner and other != owner)
      _update(owner, turnedAway.union(Set(other)), tally)
    else _unchanged

  /// `person` adds one to the tally; nothing changes if they are turned away.
  action addOne(person: Person): bool =
    if (not(turnedAway.contains(person))) _update(owner, turnedAway, tally + 1)
    else _unchanged

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    any {
      claim(person),
      turnAway(person, other),
      addOne(person),
    }
  }

  /// The owner is never turned away.
  val invOwnerNeverTurnedAway = not(turnedAway.contains(owner))

  /// Only a room with an owner has anyone turned away.
  val invTurnedAwayOnlyByAnOwner = turnedAway != Set() implies owner != ""
}
