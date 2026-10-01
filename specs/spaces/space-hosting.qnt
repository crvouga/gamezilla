// Hosting a space among friends.
//
// Alice and Bob are friends. Either can create a space, host it and be in it;
// step out to the lobby and return to their own open space; look at the
// space's presence, which counts who is in it; and end the space. The other
// can join a friend's open space from their lobby, step out, and leave it. A
// lobby lists every open space of the person and their friends. Ending a
// space shows everyone looking at it that it has ended; from there they go
// back to the lobby. Losing the connection is not leaving. Creating, joining,
// stepping out, leaving, looking at presence and ending a space need a
// connection. Someone without a connection keeps their last known space
// and lobby until returning. They stop showing as present while away; on
// return they appear once in an open space, or learn that it ended.
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
  /// a space that has ended; Left(host): looking at a space the person left.
  type Whereabouts =
    | Lobby
    | InSpace(Person)
    | ViewingPresence(Person)
    | Ended
    | Left(Person)

  /// Where each person is.
  var whereabouts: Person -> Whereabouts
  /// The hosts of the open spaces.
  var openSpaces: Set[Person]
  /// What each person's lobby lists, while they are in it: whose spaces.
  var lobby: Person -> Set[Person]
  /// What the presence each person is looking at counts: people in that space.
  var presence: Person -> int
  /// Where people are, including changes they have not yet learned.
  var _whereabouts: Person -> Whereabouts
  /// Where and which spaces people last knew when their connection went.
  var _cutOffWhereabouts: Person -> Whereabouts
  var _cutOffLobby: Person -> Set[Person]
  /// People whose device has no connection.
  var _offline: Set[Person]
  /// How many times each person has hosted, joined, left or looked, and how
  /// many when their connection went.
  var _done: Person -> int
  var _doneAtCutOff: Person -> int

  def _acted(person: Person): Person -> int =
    _done.set(person, _done.get(person) + 1)

  pure def hostOf(p: Whereabouts): Person = match p {
    | InSpace(h) => h
    | ViewingPresence(h) => h
    | _ => ""
  }

  pure def targetOf(p: Whereabouts): Person = match p {
    | Left(h) => h
    | _ => hostOf(p)
  }

  pure def presenceOf(whereabouts: Person -> Whereabouts, h: Person): Set[Person] =
    PEOPLE.filter(p => hostOf(whereabouts.get(p)) == h)

  pure def _listing(whereabouts: Person -> Whereabouts, openSpaces: Set[Person]): Person -> Set[Person] =
    PEOPLE.mapBy(p => if (whereabouts.get(p) == Lobby) openSpaces else Set())

  pure def _counting(where: Person -> Whereabouts, offline: Set[Person]): Person -> int =
    PEOPLE.mapBy(p =>
      if (offline.contains(p)) 0
      else match where.get(p) {
        | ViewingPresence(h) => presenceOf(where, h).exclude(offline).size()
        | _ => 0
      })

  action _moveTo(
    newWhereabouts: Person -> Whereabouts,
    newOpenSpaces: Set[Person],
    newOffline: Set[Person],
    newDone: Person -> int,
    newCutOff: Person -> int,
  ): bool = all {
    _whereabouts' = newWhereabouts,
    whereabouts' = PEOPLE.mapBy(p =>
      if (newOffline.contains(p)) whereabouts.get(p) else newWhereabouts.get(p)),
    openSpaces' = newOpenSpaces,
    lobby' = PEOPLE.mapBy(p =>
      if (newOffline.contains(p)) lobby.get(p)
      else _listing(newWhereabouts, newOpenSpaces).get(p)),
    presence' = _counting(newWhereabouts, newOffline),
    _cutOffWhereabouts' = PEOPLE.mapBy(p =>
      if (newOffline.contains(p)) {
        if (_offline.contains(p)) _cutOffWhereabouts.get(p) else whereabouts.get(p)
      } else newWhereabouts.get(p)),
    _cutOffLobby' = PEOPLE.mapBy(p =>
      if (newOffline.contains(p)) {
        if (_offline.contains(p)) _cutOffLobby.get(p) else lobby.get(p)
      } else _listing(newWhereabouts, newOpenSpaces).get(p)),
    _offline' = newOffline,
    _done' = newDone,
    _doneAtCutOff' = newCutOff,
  }

  action init = all {
    whereabouts' = PEOPLE.mapBy(_ => Lobby),
    _whereabouts' = PEOPLE.mapBy(_ => Lobby),
    _cutOffWhereabouts' = PEOPLE.mapBy(_ => Lobby),
    openSpaces' = Set(), lobby' = PEOPLE.mapBy(_ => Set()),
    _cutOffLobby' = PEOPLE.mapBy(_ => Set()), presence' = PEOPLE.mapBy(_ => 0),
    _offline' = Set(), _done' = PEOPLE.mapBy(_ => 0), _doneAtCutOff' = PEOPLE.mapBy(_ => 0),
  }

  /// Create a space: the person hosts it and is in it, and it is open.
  action createSpace(person: Person): bool = all {
    not(_offline.contains(person)),
    _whereabouts.get(person) == Lobby,
    not(openSpaces.contains(person)),
    _moveTo(
      _whereabouts.set(person, InSpace(person)), openSpaces.union(Set(person)),
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Return from the lobby to one's own open space.
  action returnToSpace(person: Person): bool = all {
    not(_offline.contains(person)),
    _whereabouts.get(person) == Lobby,
    openSpaces.contains(person),
    _moveTo(_whereabouts.set(person, InSpace(person)), openSpaces, _offline, _acted(person), _doneAtCutOff),
  }

  /// Join a friend's open space from the lobby.
  action join(person: Person, host: Person): bool = all {
    not(_offline.contains(person)),
    _whereabouts.get(person) == Lobby,
    host != person,
    openSpaces.contains(host),
    _moveTo(_whereabouts.set(person, InSpace(host)), openSpaces, _offline, _acted(person), _doneAtCutOff),
  }

  /// Step out to the lobby without leaving the space.
  action stepOut(person: Person): bool = all {
    not(_offline.contains(person)),
    match _whereabouts.get(person) { | InSpace(_) => true | _ => false },
    _moveTo(_whereabouts.set(person, Lobby), openSpaces, _offline, _acted(person), _doneAtCutOff),
  }

  /// Leaving ends the space when the person is its host; otherwise only
  /// that person leaves it and can join it again. The outcome stays visible.
  action leave(person: Person): bool = all {
    not(_offline.contains(person)),
    match _whereabouts.get(person) { | InSpace(_) => true | _ => false },
    if (hostOf(_whereabouts.get(person)) == person)
      _moveTo(
        PEOPLE.mapBy(p =>
          if (targetOf(_whereabouts.get(p)) == person) Ended
          else _whereabouts.get(p)
        ),
        openSpaces.exclude(Set(person)), _offline, _acted(person), _doneAtCutOff,
      )
    else
      _moveTo(_whereabouts.set(person, Left(hostOf(_whereabouts.get(person)))), openSpaces, _offline, _acted(person), _doneAtCutOff),
  }

  /// Look at who is in the space.
  action viewPresence(person: Person): bool = all {
    not(_offline.contains(person)),
    match _whereabouts.get(person) { | InSpace(_) => true | _ => false },
    _moveTo(
      _whereabouts.set(person, ViewingPresence(hostOf(_whereabouts.get(person)))), openSpaces,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Stop looking at who is in the space, still in it.
  action stopViewingPresence(person: Person): bool = all {
    not(_offline.contains(person)),
    match _whereabouts.get(person) { | ViewingPresence(_) => true | _ => false },
    _moveTo(
      _whereabouts.set(person, InSpace(hostOf(_whereabouts.get(person)))), openSpaces,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// The host ends their space: everyone looking at it sees that it has ended.
  action endSpace(person: Person): bool = all {
    not(_offline.contains(person)),
    _whereabouts.get(person) == InSpace(person),
    _moveTo(
      PEOPLE.mapBy(p => if (targetOf(_whereabouts.get(p)) == person) Ended else _whereabouts.get(p)),
      openSpaces.exclude(Set(person)),
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// From a space that has ended or one the person left, go back to the lobby.
  action goBackToLobby(person: Person): bool = all {
    not(_offline.contains(person)),
    match _whereabouts.get(person) { | Ended => true | Left(_) => true | _ => false },
    _moveTo(_whereabouts.set(person, Lobby), openSpaces, _offline, _acted(person), _doneAtCutOff),
  }

  /// `person`'s device loses its connection. That is not leaving.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _moveTo(
      _whereabouts, openSpaces, _offline.union(Set(person)), _done,
      _doneAtCutOff.set(person, _done.get(person)),
    ),
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    _moveTo(_whereabouts, openSpaces, Set(), _done, _doneAtCutOff),
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
    hostOf(_whereabouts.get(p)) == "" or openSpaces.contains(hostOf(_whereabouts.get(p))),
    not(_offline.contains(p)) implies whereabouts.get(p) == _whereabouts.get(p),
  })

  /// Every open space's host is one of the people.
  val invHostsAreThePeople = openSpaces.subseteq(PEOPLE)

  /// A connected lobby lists exactly the open spaces.
  val invLobbyListsOpenSpaces = PEOPLE.forall(p =>
    not(_offline.contains(p)) implies lobby.get(p) == _listing(_whereabouts, openSpaces).get(p))

  /// Presence counts connected people once and shows none while away.
  val invPresenceCountsTheSpace = presence == _counting(_whereabouts, _offline)

  /// A person away keeps their last known space and lobby.
  val invOfflineKeepsLastKnown = PEOPLE.forall(p =>
    _offline.contains(p) implies all {
      whereabouts.get(p) == _cutOffWhereabouts.get(p),
      lobby.get(p) == _cutOffLobby.get(p),
    })

  /// With no connection, a person hosts, joins, leaves and looks no further
  /// time. Losing the connection is not leaving.
  val invOfflineDoesNoMore = PEOPLE.forall(p =>
    _offline.contains(p) implies _done.get(p) == _doneAtCutOff.get(p)
  )
  pure val _places = Set(Lobby, Ended).union(PEOPLE.map(Left)).union(PEOPLE.map(InSpace)).union(PEOPLE.map(ViewingPresence))

  // The promises hold for any length of hosting, joining, ending and returning.
  val _inductive = all {
    whereabouts.in(PEOPLE.setOfMaps(_places)),
    _whereabouts.in(PEOPLE.setOfMaps(_places)),
    _cutOffWhereabouts.in(PEOPLE.setOfMaps(_places)),
    openSpaces.in(PEOPLE.powerset()),
    lobby.in(PEOPLE.setOfMaps(PEOPLE.powerset())),
    _cutOffLobby.in(PEOPLE.setOfMaps(PEOPLE.powerset())),
    presence.in(PEOPLE.setOfMaps(0.to(PEOPLE.size()))),
    _offline.in(PEOPLE.powerset()),
    _done.in(PEOPLE.setOfMaps(Nat)),
    _doneAtCutOff.in(PEOPLE.setOfMaps(Nat)),
    invOnlyOpenSpaces, invHostsAreThePeople, invLobbyListsOpenSpaces,
    invPresenceCountsTheSpace, invOfflineKeepsLastKnown, invOfflineDoesNoMore,
  }

}
