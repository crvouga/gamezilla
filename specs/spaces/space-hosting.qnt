// Hosting a space among friends.
//
// Alice and Bob are friends. Either can create a space, host it and be in it;
// step out to the lobby and return to their own open space; look at the
// space's presence, which counts who is in it; and end the space. The other
// can join a friend's open space from their lobby, step out, and leave it. A
// lobby lists every open space of the person and their friends. Ending a
// space shows everyone still in it that it has ended; from there they go
// back to the lobby.
//
// What a person can observe: their whereabouts, which spaces are open, what
// their lobby lists, and how many people the presence they are looking at
// counts.
module space_hosting {
  type Person = str

  /// Two signed-in friends.
  pure val PEOPLE: Set[Person] = Set("alice", "bob")

  /// Lobby: in the lobby; InSpace(host): in the space `host` hosts;
  /// ViewingPresence(host): in it, looking at who is there; Ended: looking at
  /// a space that has ended.
  type Whereabouts =
    | Lobby
    | InSpace(Person)
    | ViewingPresence(Person)
    | Ended

  /// Where each person is.
  var whereabouts: Person -> Whereabouts
  /// The hosts of the open spaces.
  var openSpaces: Set[Person]
  /// What each person's lobby lists, while they are in it: whose spaces.
  var lobby: Person -> Set[Person]
  /// What the presence each person is looking at counts: people in that space.
  var presence: Person -> int

  pure def hostOf(p: Whereabouts): Person = match p {
    | InSpace(h) => h
    | ViewingPresence(h) => h
    | _ => ""
  }

  pure def presenceOf(whereabouts: Person -> Whereabouts, h: Person): Set[Person] =
    PEOPLE.filter(p => hostOf(whereabouts.get(p)) == h)

  pure def _listing(whereabouts: Person -> Whereabouts, openSpaces: Set[Person]): Person -> Set[Person] =
    PEOPLE.filter(p => whereabouts.get(p) == Lobby).mapBy(_ => openSpaces)

  pure def _counting(whereabouts: Person -> Whereabouts): Person -> int =
    PEOPLE
      .filter(p => match whereabouts.get(p) { | ViewingPresence(_) => true | _ => false })
      .mapBy(p => presenceOf(whereabouts, hostOf(whereabouts.get(p))).size())

  action _moveTo(newWhereabouts: Person -> Whereabouts, newOpenSpaces: Set[Person]): bool = all {
    whereabouts' = newWhereabouts,
    openSpaces' = newOpenSpaces,
    lobby' = _listing(newWhereabouts, newOpenSpaces),
    presence' = _counting(newWhereabouts),
  }

  action init = _moveTo(PEOPLE.mapBy(_ => Lobby), Set())

  /// Create a space: the person hosts it and is in it, and it is open.
  action createSpace(person: Person): bool = all {
    whereabouts.get(person) == Lobby,
    not(openSpaces.contains(person)),
    _moveTo(whereabouts.set(person, InSpace(person)), openSpaces.union(Set(person))),
  }

  /// Return from the lobby to one's own open space.
  action returnToSpace(person: Person): bool = all {
    whereabouts.get(person) == Lobby,
    openSpaces.contains(person),
    _moveTo(whereabouts.set(person, InSpace(person)), openSpaces),
  }

  /// Join a friend's open space from the lobby.
  action join(person: Person, host: Person): bool = all {
    whereabouts.get(person) == Lobby,
    host != person,
    openSpaces.contains(host),
    _moveTo(whereabouts.set(person, InSpace(host)), openSpaces),
  }

  /// Step out to the lobby without leaving the space.
  action stepOut(person: Person): bool = all {
    match whereabouts.get(person) { | InSpace(_) => true | _ => false },
    _moveTo(whereabouts.set(person, Lobby), openSpaces),
  }

  /// Someone who is not the host leaves the space for good.
  action leave(person: Person): bool = all {
    match whereabouts.get(person) { | InSpace(h) => h != person | _ => false },
    _moveTo(whereabouts.set(person, Lobby), openSpaces),
  }

  /// Look at who is in the space.
  action viewPresence(person: Person): bool = all {
    match whereabouts.get(person) { | InSpace(_) => true | _ => false },
    _moveTo(whereabouts.set(person, ViewingPresence(hostOf(whereabouts.get(person)))), openSpaces),
  }

  /// Stop looking at who is in the space, still in it.
  action stopViewingPresence(person: Person): bool = all {
    match whereabouts.get(person) { | ViewingPresence(_) => true | _ => false },
    _moveTo(whereabouts.set(person, InSpace(hostOf(whereabouts.get(person)))), openSpaces),
  }

  /// The host ends their space: everyone in it sees that it has ended.
  action endSpace(person: Person): bool = all {
    whereabouts.get(person) == InSpace(person),
    _moveTo(
      PEOPLE.mapBy(p => if (hostOf(whereabouts.get(p)) == person) Ended else whereabouts.get(p)),
      openSpaces.exclude(Set(person)),
    ),
  }

  /// From a space that has ended, go back to the lobby.
  action goBackToLobby(person: Person): bool = all {
    whereabouts.get(person) == Ended,
    _moveTo(whereabouts.set(person, Lobby), openSpaces),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet host = PEOPLE.oneOf()
    any {
      createSpace(person),
      returnToSpace(person),
      join(person, host),
      stepOut(person),
      leave(person),
      viewPresence(person),
      stopViewingPresence(person),
      endSpace(person),
      goBackToLobby(person),
    }
  }

  /// Nobody is in a space that is not open.
  val invOnlyOpenSpaces = PEOPLE.forall(p =>
    hostOf(whereabouts.get(p)) == "" or openSpaces.contains(hostOf(whereabouts.get(p)))
  )

  /// Every open space's host is one of the people.
  val invHostsAreThePeople = openSpaces.subseteq(PEOPLE)
}
