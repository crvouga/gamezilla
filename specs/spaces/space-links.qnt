// Bob follows a space link. Alice may be hosting an open space, have ended
// it, or be offline; a link may also lead to a space that never existed.
// The link shows Bob where it leads. Joining is offered only for an open
// space whose host is online. Opening the same link again shows the same
// outcome while those facts stay the same. Alice can lose her connection
// and get it back. Bob stays online; while Alice is offline, her open
// space's link says the host is offline and does not offer joining.
module space_links {
  type Person = str
  /// Where the link leads: an open space, an ended space, a space that cannot
  /// be found, or a space whose host is offline.
  pure val DESTINATIONS = Set("open", "ended", "not found")

  /// What Bob sees from the link: "none" before opening it, then "open",
  /// "ended", "not found", or "host offline".
  var linkDestination: str
  /// Whether Bob is offered to join the space from its link.
  var joinOffered: bool
  /// The space the link leads to, unchanged while Bob opens it again.
  var _destination: str
  /// Whether Alice has no connection. Bob stays online.
  var _offline: Set[str]

  pure def _shown(destination: str, offline: Set[str]): str =
    if (destination == "open" and offline.contains("alice")) "host offline"
    else destination

  action _show(opened: bool, offline: Set[str]): bool = {
    val shown = if (opened) _shown(_destination, offline) else "none"
    all {
      _destination' = _destination,
      _offline' = offline,
      linkDestination' = shown,
      joinOffered' = shown == "open",
    }
  }

  action init = {
    nondet destination = DESTINATIONS.oneOf()
    all {
      _destination' = destination,
      _offline' = Set(),
      linkDestination' = "none",
      joinOffered' = false,
    }
  }

  /// Bob opens the space link and sees where it leads.
  action openSpaceLink: bool = _show(true, _offline)

  /// Alice loses her connection; her open space no longer offers joining.
  action loseConnection(person: Person): bool = all {
    person == "alice", not(_offline.contains(person)),
    _show(linkDestination != "none", _offline.union(Set(person))),
  }

  /// Alice's connection returns; her open space offers joining again.
  action connectionReturns(person: Person): bool = all {
    _offline.contains(person),
    _show(linkDestination != "none", _offline.exclude(Set(person))),
  }

  action step = {
    nondet person = Set("alice").oneOf()
    any { openSpaceLink, loseConnection(person), connectionReturns(person) }
  }

  /// Opening a space link always shows the space it leads to.
  val invLinkShowsItsDestination =
    linkDestination == "none" or linkDestination == _shown(_destination, _offline)

  /// Only an open space whose host is online offers joining from its link.
  val invJoiningOfferedOnlyForOpenSpace = joinOffered == (linkDestination == "open")

  /// An offline host's open space cannot be joined from its link.
  val invOfflineHostPreventsJoining = _offline.contains("alice") implies not(joinOffered)

  // These promises hold however often Bob opens the link or Alice goes away
  // and comes back.
  val _inductive = all {
    _destination.in(DESTINATIONS),
    _offline.in(Set("alice").powerset()),
    invLinkShowsItsDestination,
    invJoiningOfferedOnlyForOpenSpace,
    invOfflineHostPreventsJoining,
  }
}
