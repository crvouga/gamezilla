// Returning to a space the app can't reach.
//
// Alice hosts a space, and her lobby lists it. That space can stop existing
// while her lobby still lists it. Returning to the space puts her in it
// while it exists; when it can't be reached she is told so within moments
// and offered to try again and the way back to Spaces. Trying again, which
// needs her connection, tells her so again while it still can't be
// reached. Her lobby keeps listing it.
//
// Alice can lose her connection and get it back. Without one, her device
// cannot learn that her space no longer exists, so returning to it puts her
// in it as before, the way a host uses their own space offline; when her
// connection comes back she is told it can't be reached.
//
// What a person can observe: where Alice is, and whether her lobby lists her
// own space.
module space_unreachable {
  type Person = str

  /// Alice, whose lobby lists the space she hosted.
  pure val PEOPLE: Set[Person] = Set("alice")

  /// Where Alice can be: in the lobby, in her own space, or told her space
  /// can't be reached right now.
  pure val PLACES: Set[str] = Set("lobby", "own space", "can't be reached")

  /// Where Alice is: one of PLACES.
  var whereabouts: str
  /// Whether Alice's lobby lists the space she hosted.
  var lobby: bool
  /// Whether Alice's space still exists.
  var _exists: bool
  /// People whose device has no connection.
  var _offline: Set[Person]

  action init = all {
    whereabouts' = "lobby",
    lobby' = true,
    _exists' = true,
    _offline' = Set(),
  }

  action _become(where: str, present: bool, offline: Set[Person]): bool = all {
    whereabouts' = where,
    lobby' = lobby,
    _exists' = present,
    _offline' = offline,
  }

  /// Where returning or trying again leads: her space while it exists or
  /// while her device cannot learn otherwise, and otherwise word that it
  /// can't be reached.
  pure def _arrival(present: bool, offline: Set[Person]): str =
    if (present or offline.contains("alice")) "own space" else "can't be reached"

  /// Alice's space stops existing while she is not in it; her lobby still
  /// lists it.
  action spaceNoLongerExists = all {
    _exists,
    whereabouts != "own space",
    _become(whereabouts, false, _offline),
  }

  /// Alice returns to the space her lobby lists.
  action returnToSpace = all {
    whereabouts == "lobby",
    lobby,
    _become(_arrival(_exists, _offline), _exists, _offline),
  }

  /// Alice, told her space can't be reached, tries again, which needs her
  /// connection.
  action tryAgain = all {
    whereabouts == "can't be reached",
    not(_offline.contains("alice")),
    _become(_arrival(_exists, _offline), _exists, _offline),
  }

  /// A person loses their connection.
  action loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _become(whereabouts, _exists, _offline.union(Set(person))),
  }

  /// A person's connection comes back. Alice, in a space that no longer
  /// exists, is told it can't be reached.
  action connectionReturns(person: Person): bool = {
    val back = _offline.exclude(Set(person))
    all {
      _offline.contains(person),
      if (whereabouts == "own space" and not(_exists))
        _become("can't be reached", false, back)
      else _become(whereabouts, _exists, back),
    }
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    any {
      spaceNoLongerExists,
      returnToSpace,
      tryAgain,
      loseConnection(person),
      connectionReturns(person),
    }
  }

  /// Alice is somewhere a person can be.
  val invKnownPlace = PLACES.contains(whereabouts)

  /// With a connection, Alice is never in a space that no longer exists.
  val invNeverInMissingSpace =
    (whereabouts == "own space" and not(_offline.contains("alice"))) implies _exists

  /// Alice is told her space can't be reached only when it can't be.
  val invToldOnlyWhenUnreachable =
    whereabouts == "can't be reached" implies not(_exists)

  /// Alice's lobby keeps listing her space.
  val invLobbyKeepsListing = lobby
}
