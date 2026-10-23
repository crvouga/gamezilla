// @spec-meta — Quint runner fixture: the door of door.qnt, replayed once per variant by the
// runner's variants test. With no connection, that person cannot open, close,
// lock or unlock it; the other person still can.
module door_variants {
  val PEOPLE = Set("ana", "ben")

  var state: str
  var lastBy: str
  var _offline: Set[str]
  var _stateAtCutOff: str

  action init = all {
    state' = "closed",
    lastBy' = "",
    _offline' = Set(),
    _stateAtCutOff' = "closed",
  }

  action open(who: str): bool = all {
    not(_offline.contains(who)),
    state == "closed",
    state' = "open",
    lastBy' = who,
    _offline' = _offline,
    _stateAtCutOff' = "open",
  }

  action close(who: str): bool = all {
    not(_offline.contains(who)),
    state == "open",
    state' = "closed",
    lastBy' = who,
    _offline' = _offline,
    _stateAtCutOff' = "closed",
  }

  action lock(who: str): bool = all {
    not(_offline.contains(who)),
    state == "closed",
    state' = "locked",
    lastBy' = who,
    _offline' = _offline,
    _stateAtCutOff' = "locked",
  }

  action unlock(who: str): bool = all {
    not(_offline.contains(who)),
    state == "locked",
    state' = "closed",
    lastBy' = who,
    _offline' = _offline,
    _stateAtCutOff' = "closed",
  }

  /// `who`'s device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    state' = state,
    lastBy' = lastBy,
    _offline' = _offline.union(Set(who)),
    _stateAtCutOff' = state,
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    state' = state,
    lastBy' = lastBy,
    _offline' = Set(),
    _stateAtCutOff' = _stateAtCutOff,
  }

  action step = {
    nondet who = PEOPLE.oneOf()
    any {
      open(who),
      close(who),
      lock(who),
      unlock(who),
      _loseConnection(who),
      _connectionReturns,
    }
  }

  val invKnownState = Set("closed", "open", "locked").contains(state)

  val invLastByKnown = lastBy == "" or PEOPLE.contains(lastBy)

  /// While the person who last touched the door has no connection, it stays
  /// as they left it. The other person can still move it, and then they are
  /// the one who last touched it.
  val invCutOffMatches = _offline.forall(p =>
    (p == lastBy) implies (state == _stateAtCutOff)
  )
}
