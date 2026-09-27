// Hosting a space among friends.
//
// Alice and Bob are friends. Either can open a space and is then in it; step
// out to the lobby and back into their own live space; open its member list,
// which counts who is in the space; and end it. The other can join a live
// space from their lobby, step out, and leave it. A lobby lists every live
// space of the person and their friends. Ending a space takes everyone still
// in it to the ended screen, from which they go back to the lobby.
module space_hosting {
  type Person = str

  /// Two signed-in friends.
  pure val PEOPLE: Set[Person] = Set("alice", "bob")

  /// Lobby; InSpace(host): in the space `host` opened; Members(host): in it,
  /// with its member list open; Ended: looking at a space that has ended.
  type Place =
    | Lobby
    | InSpace(Person)
    | Members(Person)
    | Ended

  /// Where each person is.
  var place: Person -> Place
  /// The people hosting a live space.
  var live: Set[Person]
  /// What each person's lobby lists, while they are in it: whose spaces.
  var listed: Person -> Set[Person]
  /// What each open member list counts: people in that space.
  var present: Person -> int

  pure def hostOf(p: Place): Person = match p {
    | InSpace(h) => h
    | Members(h) => h
    | _ => ""
  }

  pure def inSpaceOf(place: Person -> Place, h: Person): Set[Person] =
    PEOPLE.filter(p => hostOf(place.get(p)) == h)

  pure def listing(place: Person -> Place, live: Set[Person]): Person -> Set[Person] =
    PEOPLE.filter(p => place.get(p) == Lobby).mapBy(_ => live)

  pure def counting(place: Person -> Place): Person -> int =
    PEOPLE
      .filter(p => match place.get(p) { | Members(_) => true | _ => false })
      .mapBy(p => inSpaceOf(place, hostOf(place.get(p))).size())

  action moveTo(newPlace: Person -> Place, newLive: Set[Person]): bool = all {
    place' = newPlace,
    live' = newLive,
    listed' = listing(newPlace, newLive),
    present' = counting(newPlace),
  }

  action init = moveTo(PEOPLE.mapBy(_ => Lobby), Set())

  /// Open a space: the person is in it, and it is live.
  action create(person: Person): bool = all {
    place.get(person) == Lobby,
    not(live.contains(person)),
    moveTo(place.set(person, InSpace(person)), live.union(Set(person))),
  }

  /// Back into one's own live space from the lobby.
  action reopen(person: Person): bool = all {
    place.get(person) == Lobby,
    live.contains(person),
    moveTo(place.set(person, InSpace(person)), live),
  }

  /// Join a friend's live space from its lobby card.
  action join(person: Person, host: Person): bool = all {
    place.get(person) == Lobby,
    host != person,
    live.contains(host),
    moveTo(place.set(person, InSpace(host)), live),
  }

  /// Close the space screen, still a member: back to the lobby.
  action stepOut(person: Person): bool = all {
    match place.get(person) { | InSpace(_) => true | _ => false },
    moveTo(place.set(person, Lobby), live),
  }

  /// A guest leaves the space for good.
  action leave(person: Person): bool = all {
    match place.get(person) { | InSpace(h) => h != person | _ => false },
    moveTo(place.set(person, Lobby), live),
  }

  action openMembers(person: Person): bool = all {
    match place.get(person) { | InSpace(_) => true | _ => false },
    moveTo(place.set(person, Members(hostOf(place.get(person)))), live),
  }

  action closeMembers(person: Person): bool = all {
    match place.get(person) { | Members(_) => true | _ => false },
    moveTo(place.set(person, InSpace(hostOf(place.get(person)))), live),
  }

  /// The host ends their space: everyone in it sees that it has ended.
  action end(person: Person): bool = all {
    place.get(person) == InSpace(person),
    moveTo(
      PEOPLE.mapBy(p => if (hostOf(place.get(p)) == person) Ended else place.get(p)),
      live.exclude(Set(person)),
    ),
  }

  /// From the ended screen back to the lobby.
  action backToLobby(person: Person): bool = all {
    place.get(person) == Ended,
    moveTo(place.set(person, Lobby), live),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet host = PEOPLE.oneOf()
    any {
      create(person),
      reopen(person),
      join(person, host),
      stepOut(person),
      leave(person),
      openMembers(person),
      closeMembers(person),
      end(person),
      backToLobby(person),
    }
  }

  /// Nobody is in a space that is not live.
  val invOnlyLiveSpaces = PEOPLE.forall(p =>
    hostOf(place.get(p)) == "" or live.contains(hostOf(place.get(p)))
  )

  /// Everyone hosting a live space was the one who opened it.
  val invHostsAreThePeople = live.subseteq(PEOPLE)
}
