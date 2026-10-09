// Hosting a space among friends.
//
// Alice and Bob are friends. Either can create a space, host it and be in it;
// step out to the lobby and return to their own open space; look at the
// space's presence, which counts who is in it; and end the space. The other
// can join a friend's open space from their lobby, step out, and leave it. A
// lobby lists every open space of the person and their friends. Ending a
// space shows everyone looking at it that it has ended; from there they go
// back to the lobby. Losing the connection is not leaving. A host creates,
// uses and ends their own space with or without a connection. Other people
// drop out while they or the host are offline and return once both are online.
// Joining someone else's space needs both people online. People can leave
// or step out without a connection; leaving never happens again on return.
//
// What a person can observe: their whereabouts, what
// their lobby lists, and how many people the presence they are looking at
// counts.
module space_hosting {
  type Person = str

  /// Two signed-in friends.
  pure val PEOPLE: Set[Person] = Set("alice", "bob")

  /// Lobby: in the lobby; InSpace(host): in the space `host` hosts;
  /// ViewingPresence(host): in it, looking at who is there; Ended: looking at
  /// a space that has ended; Left(host): looking at a space the person left.
  type Whereabouts =
    | Lobby
    | InSpace(Person)
    | ViewingPresence(Person)
    | Ended
    | Left(Person)
    | DroppedOut(Person)

  /// Where each person is.
  var whereabouts: Person -> Whereabouts
  /// The hosts of the open spaces.
  var _openSpaces: Set[Person]
  /// What each person's lobby lists, while they are in it: whose spaces.
  var lobby: Person -> Set[Person]
  /// What the presence each person is looking at counts: people in that space.
  var presence: Person -> int
  /// Spaces that other people can learn about while connected.
  var _sharedSpaces: Set[Person]
  /// The spaces each person knows, including their own choices while offline.
  var _knownSpaces: Person -> Set[Person]
  /// Where people are, including changes they have not yet learned.
  var _whereabouts: Person -> Whereabouts
  /// People whose device has no connection.
  var _offline: Set[Person]
  /// How many choices each person has made on their own device.
  var _done: Person -> int

  def _acted(person: Person): Person -> int =
    _done.set(person, _done.get(person) + 1)

  pure def hostOf(p: Whereabouts): Person = match p {
    | InSpace(h) => h
    | ViewingPresence(h) => h
    | _ => ""
  }

  pure def _targetOf(p: Whereabouts): Person = match p {
    | Left(h) => h
    | DroppedOut(h) => h
    | _ => hostOf(p)
  }

  pure def presenceOf(whereabouts: Person -> Whereabouts, h: Person): Set[Person] =
    PEOPLE.filter(p => hostOf(whereabouts.get(p)) == h)

  pure def _listing(whereabouts: Person -> Whereabouts, _openSpaces: Set[Person]): Person -> Set[Person] =
    PEOPLE.mapBy(p => if (whereabouts.get(p) == Lobby) _openSpaces else Set())

  pure def _counting(where: Person -> Whereabouts, offline: Set[Person]): Person -> int =
    PEOPLE.mapBy(p =>
      match where.get(p) {
        | ViewingPresence(h) =>
          if (p == h and offline.contains(h)) 1
          else if (offline.contains(p) or offline.contains(h)) 0
          else presenceOf(where, h).exclude(offline).size()
        | _ => 0
      })

  pure def _visible(person: Person, place: Whereabouts, offline: Set[Person]): Whereabouts =
    if (hostOf(place) != "" and hostOf(place) != person and
      (offline.contains(person) or offline.contains(hostOf(place))))
      DroppedOut(hostOf(place))
    else place

  action _moveTo(
    newWhereabouts: Person -> Whereabouts,
    newOpenSpaces: Set[Person],
    newOffline: Set[Person],
    newDone: Person -> int,
  ): bool = {
    val shared = newOpenSpaces.exclude(newOffline).union(_sharedSpaces.intersect(newOffline))
    val known = PEOPLE.mapBy(p =>
      if (newOffline.contains(p))
        _knownSpaces.get(p).exclude(Set(p)).union(newOpenSpaces.intersect(Set(p)))
      else shared)
    all {
      _whereabouts' = newWhereabouts,
      whereabouts' = PEOPLE.mapBy(p =>
        if ((newOffline.contains(p) or newOffline.contains(_targetOf(_whereabouts.get(p)))) and
          newDone.get(p) == _done.get(p) and _targetOf(newWhereabouts.get(p)) != p)
          _visible(p, whereabouts.get(p), newOffline)
        else _visible(p, newWhereabouts.get(p), newOffline)),
      _openSpaces' = newOpenSpaces,
      _sharedSpaces' = shared,
      _knownSpaces' = known,
      lobby' = PEOPLE.mapBy(p => if (newWhereabouts.get(p) == Lobby) known.get(p) else Set()),
      presence' = _counting(newWhereabouts, newOffline),
      _offline' = newOffline,
      _done' = newDone,
    }
  }

  action init = all {
    whereabouts' = PEOPLE.mapBy(_ => Lobby),
    _whereabouts' = PEOPLE.mapBy(_ => Lobby),
    _openSpaces' = Set(), _sharedSpaces' = Set(),
    _knownSpaces' = PEOPLE.mapBy(_ => Set()), lobby' = PEOPLE.mapBy(_ => Set()),
    presence' = PEOPLE.mapBy(_ => 0),
    _offline' = Set(), _done' = PEOPLE.mapBy(_ => 0),
  }

  /// Create a space: the person hosts it and is in it, and it is open.
  action createSpace(person: Person): bool = all {
    _whereabouts.get(person) == Lobby,
    not(_openSpaces.contains(person)),
    _moveTo(
      _whereabouts.set(person, InSpace(person)), _openSpaces.union(Set(person)),
      _offline, _acted(person),
    ),
  }

  /// Return from the lobby to one's own open space.
  action returnToSpace(person: Person): bool = all {
    _whereabouts.get(person) == Lobby,
    _openSpaces.contains(person),
    _moveTo(_whereabouts.set(person, InSpace(person)), _openSpaces, _offline, _acted(person)),
  }

  /// Join a friend's open space from the lobby.
  action join(person: Person, host: Person): bool = all {
    not(_offline.contains(person)),
    not(_offline.contains(host)),
    _whereabouts.get(person) == Lobby,
    host != person,
    _openSpaces.contains(host),
    _moveTo(_whereabouts.set(person, InSpace(host)), _openSpaces, _offline, _acted(person)),
  }

  /// Step out to the lobby without leaving the space.
  action stepOut(person: Person): bool = all {
    match _whereabouts.get(person) { | InSpace(_) => true | _ => false },
    _moveTo(_whereabouts.set(person, Lobby), _openSpaces, _offline, _acted(person)),
  }

  /// Leaving ends the space when the person is its host; otherwise only
  /// that person leaves it and can join it again. The outcome stays visible.
  action leave(person: Person): bool = all {
    match _whereabouts.get(person) { | InSpace(_) => true | _ => false },
    if (hostOf(_whereabouts.get(person)) == person)
      _moveTo(
        PEOPLE.mapBy(p =>
          if (_targetOf(_whereabouts.get(p)) == person) Ended
          else _whereabouts.get(p)
        ),
        _openSpaces.exclude(Set(person)), _offline, _acted(person),
      )
    else
      _moveTo(_whereabouts.set(person, Left(hostOf(_whereabouts.get(person)))), _openSpaces, _offline, _acted(person)),
  }

  /// Look at who is in the space.
  action viewPresence(person: Person): bool = all {
    match _whereabouts.get(person) { | InSpace(_) => true | _ => false },
    _moveTo(
      _whereabouts.set(person, ViewingPresence(hostOf(_whereabouts.get(person)))), _openSpaces,
      _offline, _acted(person),
    ),
  }

  /// Stop looking at who is in the space, still in it.
  action stopViewingPresence(person: Person): bool = all {
    match _whereabouts.get(person) { | ViewingPresence(_) => true | _ => false },
    _moveTo(
      _whereabouts.set(person, InSpace(hostOf(_whereabouts.get(person)))), _openSpaces,
      _offline, _acted(person),
    ),
  }

  /// The host ends their space: everyone looking at it sees that it has ended.
  action endSpace(person: Person): bool = all {
    _whereabouts.get(person) == InSpace(person),
    _moveTo(
      PEOPLE.mapBy(p => if (_targetOf(_whereabouts.get(p)) == person) Ended else _whereabouts.get(p)),
      _openSpaces.exclude(Set(person)),
      _offline, _acted(person),
    ),
  }

  /// From a space that has ended or one the person left, go back to the lobby.
  action goBackToLobby(person: Person): bool = all {
    match _whereabouts.get(person) { | Ended => true | Left(_) => true | _ => false },
    _moveTo(_whereabouts.set(person, Lobby), _openSpaces, _offline, _acted(person)),
  }

  /// `person`'s device loses its connection. That is not leaving.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _moveTo(
      _whereabouts, _openSpaces, _offline.union(Set(person)), _done,
    ),
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    _moveTo(_whereabouts, _openSpaces, Set(), _done),
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
      _loseConnection(person),
      _connectionReturns,
    }
  }

  /// Nobody remains in an ended space; people away learn it on return.
  val invOnlyOpenSpaces = PEOPLE.forall(p => all {
    hostOf(_whereabouts.get(p)) == "" or _openSpaces.contains(hostOf(_whereabouts.get(p))),
    not(_offline.contains(p)) and not(_offline.contains(_targetOf(whereabouts.get(p)))) implies whereabouts.get(p) == _visible(p, _whereabouts.get(p), _offline),
  })

  /// Every open space's host is one of the people.
  val invHostsAreThePeople = _openSpaces.subseteq(PEOPLE)

  /// A lobby lists the person's last known spaces and their own local choices.
  val invLobbyListsOpenSpaces = lobby == PEOPLE.mapBy(p =>
    if (_whereabouts.get(p) == Lobby) _knownSpaces.get(p) else Set())

  /// Presence counts connected people once; an offline host sees only themselves.
  val invPresenceCountsTheSpace = presence == _counting(_whereabouts, _offline)

  /// A host keeps using their own space while offline.
  val invOfflineHostKeepsTheirSpace = PEOPLE.forall(p =>
    _offline.contains(p) and hostOf(_whereabouts.get(p)) == p implies
      whereabouts.get(p) == _whereabouts.get(p))

  /// Nobody stays in someone else's space while that host is offline.
  val invGuestsFollowHost = PEOPLE.forall(p =>
    hostOf(whereabouts.get(p)) != "" and hostOf(whereabouts.get(p)) != p implies
      not(_offline.contains(hostOf(whereabouts.get(p)))))
  pure val _places = Set(Lobby, Ended).union(PEOPLE.map(Left)).union(PEOPLE.map(DroppedOut)).union(PEOPLE.map(InSpace)).union(PEOPLE.map(ViewingPresence))

  // The promises hold for any length of hosting, joining, ending and returning.
  val _inductive = all {
    whereabouts.in(PEOPLE.setOfMaps(_places)),
    _whereabouts.in(PEOPLE.setOfMaps(_places)),
    _openSpaces.in(PEOPLE.powerset()),
    _sharedSpaces.in(PEOPLE.powerset()),
    _knownSpaces.in(PEOPLE.setOfMaps(PEOPLE.powerset())),
    lobby.in(PEOPLE.setOfMaps(PEOPLE.powerset())),
    presence.in(PEOPLE.setOfMaps(0.to(PEOPLE.size()))),
    _offline.in(PEOPLE.powerset()),
    _done.in(PEOPLE.setOfMaps(Nat)),
    invOnlyOpenSpaces, invHostsAreThePeople, invLobbyListsOpenSpaces,
    invPresenceCountsTheSpace, invOfflineHostKeepsTheirSpace, invGuestsFollowHost,
  }

}
