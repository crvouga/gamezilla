// Three people each finish one piece of writing, in any order, online or
// offline. With their connections back and word about their saves reaching
// them, every save finishes and they eventually keep seeing the same note.
// This is a finished piece of work; a separate model covers continued writing.
module note_recovery {
  type Person = str
  type Note = { body: str, owner: Person }
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val EMPTY = { body: "", owner: "" }

  /// What each person sees, and what the shared notes keep.
  var notes: str -> Note
  /// Whether each app is told its device has a connection.
  var online: Person -> bool

  var _shared: Note
  var _snapshot: Person -> Note
  var _body: Person -> str
  var _phase: Person -> str
  var _accepted: Set[Person]
  var _previous: Note
  var _duplicate: bool

  action _settle(person: Person, body: str, phase: str, connected: Person -> bool): bool = {
    val waiting = phase == "waiting"
    val kept = waiting and connected.get(person)
    val shared = if (kept and not(_accepted.contains(person)))
      { body: body, owner: person } else _shared
    val accepted = if (kept) _accepted.union(Set(person)) else _accepted
    val phases = _phase.set(person, phase)
    val bodies = _body.set(person, body)
    val snapshots = PEOPLE.mapBy(p => if (connected.get(p)) shared else _snapshot.get(p))
    val views = PEOPLE.mapBy(p => if (phases.get(p) == "waiting")
      { body: bodies.get(p), owner: p } else snapshots.get(p))
    all {
      notes' = views.put("shared", shared),
      online' = connected,
      _shared' = shared,
      _snapshot' = snapshots,
      _body' = bodies,
      _phase' = phases,
      _accepted' = accepted,
      _previous' = _shared,
      _duplicate' = (kept and _accepted.contains(person)),
    }
  }

  action init = all {
    notes' = PEOPLE.mapBy(_ => EMPTY).put("shared", EMPTY),
    online' = PEOPLE.mapBy(_ => true),
    _shared' = EMPTY,
    _snapshot' = PEOPLE.mapBy(_ => EMPTY),
    _body' = PEOPLE.mapBy(_ => ""),
    _phase' = PEOPLE.mapBy(_ => "ready"),
    _accepted' = Set(),
    _previous' = EMPTY,
    _duplicate' = false,
  }

  /// Each person writes once; all three may be waiting to hear back together.
  action writeUnheard(person: Person, body: str): bool = all {
    _phase.get(person) == "ready",
    _settle(person, body, "waiting", online),
  }

  /// Hearing back finishes a save without repeating its earlier effect.
  action hearBack(person: Person): bool = all {
    online.get(person), _phase.get(person) == "waiting", _accepted.contains(person),
    _settle(person, _body.get(person), "done", online),
  }

  /// Losing the connection keeps every piece of writing on its device.
  action goOffline(person: Person): bool = all {
    online.get(person),
    _settle(person, _body.get(person), _phase.get(person), online.set(person, false)),
  }

  /// Returning sends the writing and catches up; hearing back may come later.
  action goOnline(person: Person): bool = all {
    not(online.get(person)),
    _settle(person, _body.get(person), _phase.get(person), online.set(person, true)),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet body = Set("milk", "eggs").oneOf()
    any { writeUnheard(person, body), hearBack(person), goOffline(person), goOnline(person) }
  }

  /// An unfinished piece of writing remains visible to its writer.
  val invWaitingPreservesWriting = PEOPLE.forall(p =>
    _phase.get(p) == "waiting" implies notes.get(p) == { body: _body.get(p), owner: p })

  /// Once caught up and heard back, a person sees the shared note.
  val invAnsweredDevicesAgree = PEOPLE.forall(p =>
    online.get(p) and _phase.get(p) != "waiting" implies notes.get(p) == _shared)

  /// Repeating a save whose word was lost preserves later writing.
  val invRepeatingPreservesLaterWriting = _duplicate implies _shared == _previous

  /// Hearing back only finishes writing already kept in the shared notes.
  val invDoneWasKept = PEOPLE.forall(p => _phase.get(p) == "done" implies _accepted.contains(p))

  /// Every piece of writing belongs to a person in the shared space.
  val invKnownOwners = notes.keys().forall(key => notes.get(key) == EMPTY or PEOPLE.contains(notes.get(key).owner))

  val _state = (notes, online, _shared, _snapshot, _body, _phase, _accepted, _previous, _duplicate)
  temporal _wordArrives = hearBack("alice").weakFair(_state)
    and hearBack("bob").weakFair(_state) and hearBack("carol").weakFair(_state)
  temporal _connectionsStay = eventually(always(PEOPLE.forall(p => online.get(p))))

  /// With their connections back, every waiting writer eventually hears back.
  temporal liveEverySaveFinishes = (_connectionsStay and _wordArrives).implies(
    PEOPLE.forall(p => (_phase.get(p) == "waiting").leadsTo(_phase.get(p) == "done")))

  /// Once people finish writing and keep their connections, they keep agreeing.
  temporal liveDevicesKeepAgreeing = (_connectionsStay and _wordArrives).implies(
    eventually(always(notes.keys().forall(key => notes.get(key) == _shared))))
}
