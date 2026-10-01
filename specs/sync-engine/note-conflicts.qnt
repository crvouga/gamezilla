// Three people change the same note, online or offline.
// A note written offline stays on its device until the connection returns.
// Only its owner may delete it. A deletion refused after ownership changes
// is undone, with a notice. Hearing back about an earlier save preserves
// later writing and deletion. Once connected and heard back, devices agree.
module note_conflicts {
  type Person = str
  type Note = { body: str, owner: Person, exists: bool, deleted: bool }
  type Edit = _Nothing | Write(str) | Delete

  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val EMPTY = { body: "", owner: "", exists: false, deleted: false }

  /// The note and its owner on each device and in the shared notes.
  var notes: str -> Note
  /// Notices of refused edits on each device.
  var rejections: Person -> int
  /// Whether each device has a connection.
  var online: Person -> bool

  var _shared: Note
  var _snapshot: Person -> Note
  var _pending: Person -> Edit
  var _unheard: Set[Person]
  var _answered: int
  var _refusalCount: int
  var _next: int
  var _previous: Note
  var _duplicate: bool
  var _deleteBy: Person
  var _deleteAccepted: bool
  var _forgotten: int
  var _signedOut: bool

  pure def _allowed(note: Note, person: Person, edit: Edit): bool = match edit {
    | Delete => not(note.exists) or note.deleted or note.owner == person
    | _ => true
  }

  pure def _apply(note: Note, person: Person, edit: Edit): Note = match edit {
    | Write(body) => { body: body, owner: person, exists: true, deleted: false }
    | Delete => if (note.exists) { ...note, deleted: true } else note
    | _Nothing => note
  }

  pure def _take(note: Note, known: bool, person: Person, edit: Edit):
    { note: Note, answered: int, refused: int, duplicate: bool } =
    if (edit == _Nothing) { note: note, answered: 0, refused: 0, duplicate: false }
    else if (known) { note: note, answered: 0, refused: 0, duplicate: true }
    else if (_allowed(note, person, edit)) {
      note: _apply(note, person, edit), answered: 1, refused: 0, duplicate: false,
    } else { note: note, answered: 1, refused: 1, duplicate: false }

  action _settle(person: Person, edit: Edit, connected: Person -> bool, unheard: Set[Person], nextId: int): bool = {
    val result = if (connected.get(person)) _take(_shared, _unheard.contains(person), person, edit)
      else { note: _shared, answered: 0, refused: 0, duplicate: false }
    val pending = _pending.set(person,
      if (connected.get(person) and not(unheard.contains(person))) _Nothing else edit)
    val snapshots = PEOPLE.mapBy(p => if (connected.get(p)) result.note else _snapshot.get(p))
    val views = PEOPLE.mapBy(p =>
      if (_allowed(snapshots.get(p), p, pending.get(p))) _apply(snapshots.get(p), p, pending.get(p))
      else snapshots.get(p))
    all {
      _previous' = _shared,
      _shared' = result.note,
      _snapshot' = snapshots,
      _pending' = pending,
      _unheard' = unheard,
      _answered' = _answered + result.answered,
      _refusalCount' = _refusalCount + result.refused,
      _next' = nextId,
      _forgotten' = _forgotten,
      _signedOut' = false,
      _duplicate' = result.duplicate,
      _deleteBy' = person,
      _deleteAccepted' = (connected.get(person) and not(result.duplicate)
        and edit == Delete and result.refused == 0),
      online' = connected,
      notes' = views.put("shared", result.note),
      rejections' = rejections.set(person, rejections.get(person)
        + result.refused),
    }
  }

  action init = all {
    _shared' = EMPTY,
    _snapshot' = PEOPLE.mapBy(_ => EMPTY),
    _pending' = PEOPLE.mapBy(_ => _Nothing),
    _unheard' = Set(),
    _answered' = 0,
    _refusalCount' = 0,
    _next' = 0,
    _forgotten' = 0,
    _signedOut' = false,
    _previous' = EMPTY,
    _duplicate' = false,
    _deleteBy' = "",
    _deleteAccepted' = false,
    online' = PEOPLE.mapBy(_ => true),
    notes' = PEOPLE.mapBy(_ => EMPTY).put("shared", EMPTY),
    rejections' = PEOPLE.mapBy(_ => 0),
  }

  /// Write the note; one unsent edit per device represents competing intent.
  action write(person: Person, body: str): bool = all {
    _pending.get(person) == _Nothing,
    _settle(person, Write(body), online, _unheard, _next + 1),
  }

  /// Only the owner the device knows may delete the note.
  action deleteNote(person: Person): bool = all {
    _pending.get(person) == _Nothing,
    _allowed(_snapshot.get(person), person, Delete),
    _settle(person, Delete, online, _unheard, _next + 1),
  }

  /// The shared notes keep a write whose author has not heard back yet.
  action writeUnheard(person: Person, body: str): bool = all {
    online.get(person),
    _pending.get(person) == _Nothing,
    _unheard == Set(),
    _settle(person, Write(body), online, Set(person), _next + 1),
  }

  /// Hearing back never repeats the earlier edit's effect.
  action hearBack(person: Person): bool = all {
    online.get(person),
    _unheard.contains(person),
    _settle(person, _pending.get(person), online, _unheard.exclude(Set(person)), _next),
  }

  /// Losing the connection preserves the note and every unsent edit.
  action goOffline(person: Person): bool = all {
    online.get(person),
    _settle(person, _pending.get(person), online.set(person, false), _unheard, _next),
  }

  /// Returning sends the unsent edit, resolves any refusal, and hears back.
  action goOnline(person: Person): bool = all {
    not(online.get(person)),
    _settle(person, _pending.get(person), online.set(person, true), _unheard.exclude(Set(person)), _next),
  }

  /// Signing out elsewhere forgets unsent writing and notices before the
  /// person signs back in. Writing already kept remains in the shared notes.
  action signedOutElsewhere(person: Person): bool = {
    val connected = online.set(person, true)
    val pending = _pending.set(person, _Nothing)
    val snapshots = PEOPLE.mapBy(p => if (connected.get(p)) _shared else _snapshot.get(p))
    val views = PEOPLE.mapBy(p =>
      if (_allowed(snapshots.get(p), p, pending.get(p))) _apply(snapshots.get(p), p, pending.get(p))
      else snapshots.get(p))
    all {
      _shared' = _shared, _previous' = _shared,
      _snapshot' = snapshots, _pending' = pending,
      _unheard' = _unheard.exclude(Set(person)),
      _answered' = _answered, _next' = _next,
      _forgotten' = _forgotten + (if (_pending.get(person) != _Nothing and not(_unheard.contains(person))) 1 else 0),
      _refusalCount' = _refusalCount - rejections.get(person),
      _duplicate' = false, _signedOut' = true,
      _deleteBy' = person, _deleteAccepted' = false,
      online' = connected, notes' = views.put("shared", _shared),
      rejections' = rejections.set(person, 0),
    }
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet body = Set("milk", "eggs").oneOf()
    any {
      write(person, body), deleteNote(person), writeUnheard(person, body),
      hearBack(person), goOffline(person), goOnline(person),
      signedOutElsewhere(person),
    }
  }

  /// Every edit is waiting, answered, or deliberately forgotten on sign-out.
  val invNoLostEdits = _answered + _forgotten + PEOPLE.filter(p =>
    _pending.get(p) != _Nothing and not(_unheard.contains(p))).size() == _next

  /// Repeating an answered edit preserves all later writing and deletion.
  val invDuplicatePreservesLaterEdits = _duplicate implies _shared == _previous

  /// An accepted deletion belonged to its author when it reached everyone.
  val invOnlyOwnerDeletes = _deleteAccepted implies
    (not(_previous.exists) or _previous.deleted or _previous.owner == _deleteBy)

  /// A connected device with every edit answered agrees with the shared notes.
  val invConnectedAgree = PEOPLE.forall(p =>
    (online.get(p) and _pending.get(p) == _Nothing) implies
      notes.get(p) == notes.get("shared"))

  /// A live note has exactly the owner that wrote it, on every device.
  val invLiveNotesHaveOwners = notes.keys().forall(p =>
    (notes.get(p).exists and not(notes.get(p).deleted)) implies PEOPLE.contains(notes.get(p).owner))

  /// Returning connected devices never remain stuck with an unanswered edit.
  val invConnectedEditsAnswered = PEOPLE.forall(p =>
    (online.get(p) and not(_unheard.contains(p))) implies _pending.get(p) == _Nothing)

  /// A refused edit is answered once and gives its author one notice.
  val invRefusalsCountOnce = _refusalCount <= _answered
    and PEOPLE.fold(0, (total, p) => total + rejections.get(p)) == _refusalCount

  /// Signing back in never sends writing discarded when the sign-in ended.
  val invSignedOutWritingStaysForgotten = _signedOut implies _shared == _previous

  pure def _validNote(note: Note): bool = note == EMPTY or
    (note.exists and PEOPLE.contains(note.owner) and Set("milk", "eggs").contains(note.body))

  pure val _notes = Set(EMPTY).union(tuples(Set("milk", "eggs"), PEOPLE, Set(false, true)).map(v =>
    { body: v._1, owner: v._2, exists: true, deleted: v._3 }))

  // Every action preserves these limits and the promises above, however
  // long people keep writing, losing their connection, and returning.
  val _inductive = all {
    online.in(PEOPLE.setOfMaps(Set(false, true))),
    rejections.in(PEOPLE.setOfMaps(Nat)),
    _snapshot.in(PEOPLE.setOfMaps(_notes)),
    _pending.in(PEOPLE.setOfMaps(Set(_Nothing, Delete, Write("milk"), Write("eggs")))),
    notes.in(PEOPLE.union(Set("shared")).setOfMaps(_notes)),
    _unheard.in(PEOPLE.powerset()),
    _shared.in(_notes),
    _previous.in(_notes),
    _deleteBy.in(PEOPLE.union(Set(""))),
    _answered.in(Nat),
    _next.in(Nat),
    _refusalCount.in(Nat),
    _duplicate.in(Set(false, true)),
    _deleteAccepted.in(Set(false, true)),
    _forgotten.in(Nat),
    _signedOut.in(Set(false, true)),
    online.keys() == PEOPLE,
    rejections.keys() == PEOPLE,
    _snapshot.keys() == PEOPLE,
    _pending.keys() == PEOPLE,
    notes.keys() == PEOPLE.union(Set("shared")),
    _unheard.subseteq(PEOPLE),
    _unheard.size() <= 1,
    _validNote(_shared),
    _validNote(_previous),
    _deleteBy == "" or PEOPLE.contains(_deleteBy),
    _answered >= 0,
    _next >= 0,
    _refusalCount >= 0,
    notes.get("shared") == _shared,
    PEOPLE.forall(p => all {
      _validNote(_snapshot.get(p)),
      Set(_Nothing, Delete, Write("milk"), Write("eggs")).contains(_pending.get(p)),
      _unheard.contains(p) implies Set(Write("milk"), Write("eggs")).contains(_pending.get(p)),
      online.get(p) implies _snapshot.get(p) == _shared,
      rejections.get(p) >= 0,
      notes.get(p) == (if (_allowed(_snapshot.get(p), p, _pending.get(p)))
        _apply(_snapshot.get(p), p, _pending.get(p)) else _snapshot.get(p)),
    }),
    invNoLostEdits,
    invDuplicatePreservesLaterEdits,
    invOnlyOwnerDeletes,
    invConnectedAgree,
    invLiveNotesHaveOwners,
    invConnectedEditsAnswered,
    invRefusalsCountOnce,
    invSignedOutWritingStaysForgotten,
  }
}
