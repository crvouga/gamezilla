// Three people change the same note, online or offline.
// A note written offline stays on its device until the connection returns.
// Only its owner may delete it. A deletion refused after ownership changes
// is undone, with a notice. Hearing back about an earlier save preserves
// later writing and deletion. Once connected and heard back, devices agree.
module note_conflicts {
  type Person = str
  type Note = { body: str, owner: Person, exists: bool, deleted: bool }
  type Edit = Nothing | Write({ id: int, body: str }) | Delete(int)

  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val EMPTY = { body: "", owner: "", exists: false, deleted: false }
  pure val TITLE = "Groceries"

  /// The note and its owner on each device and in the shared notes.
  var notes: str -> (str -> str)
  var owners: str -> (str -> Person)
  /// Notices of refused edits on each device.
  var rejections: Person -> int
  /// Whether each device has a connection.
  var online: Person -> bool

  var _shared: Note
  var _snapshot: Person -> Note
  var _pending: Person -> Edit
  var _unheard: Set[Person]
  var _seen: Set[int]
  var _refused: Set[int]
  var _next: int
  var _previous: Note
  var _duplicate: bool
  var _deleteBy: Person
  var _deleteAccepted: bool

  pure def _id(edit: Edit): int = match edit {
    | Nothing => -1
    | Write(w) => w.id
    | Delete(id) => id
  }

  pure def _allowed(note: Note, person: Person, edit: Edit): bool = match edit {
    | Delete(_) => not(note.exists) or note.deleted or note.owner == person
    | _ => true
  }

  pure def _apply(note: Note, person: Person, edit: Edit): Note = match edit {
    | Write(w) => { body: w.body, owner: person, exists: true, deleted: false }
    | Delete(_) => if (note.exists) { ...note, deleted: true } else note
    | Nothing => note
  }

  pure def _take(note: Note, seen: Set[int], refused: Set[int], person: Person, edit: Edit):
    { note: Note, seen: Set[int], refused: Set[int], duplicate: bool } = {
    val id = _id(edit)
    if (edit == Nothing) { note: note, seen: seen, refused: refused, duplicate: false }
    else if (seen.contains(id)) { note: note, seen: seen, refused: refused, duplicate: true }
    else if (_allowed(note, person, edit)) {
      note: _apply(note, person, edit), seen: seen.union(Set(id)), refused: refused, duplicate: false,
    } else {
      note: note, seen: seen.union(Set(id)), refused: refused.union(Set(id)), duplicate: false,
    }
  }

  pure def _live(note: Note): str -> str =
    if (note.exists and not(note.deleted)) Map(TITLE -> note.body) else Map()

  pure def _owner(note: Note): str -> Person =
    if (note.exists and not(note.deleted)) Map(TITLE -> note.owner) else Map()

  action _settle(person: Person, edit: Edit, connected: Person -> bool, unheard: Set[Person], nextId: int): bool = {
    val result = if (connected.get(person)) _take(_shared, _seen, _refused, person, edit)
      else { note: _shared, seen: _seen, refused: _refused, duplicate: false }
    val pending = _pending.set(person,
      if (connected.get(person) and not(unheard.contains(person))) Nothing else edit)
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
      _seen' = result.seen,
      _refused' = result.refused,
      _next' = nextId,
      _duplicate' = result.duplicate,
      _deleteBy' = person,
      _deleteAccepted' = (connected.get(person) and not(result.duplicate)
        and (match edit { | Delete(_) => not(result.refused.contains(_id(edit))) | _ => false })),
      online' = connected,
      notes' = PEOPLE.mapBy(p => _live(views.get(p))).put("shared", _live(result.note)),
      owners' = PEOPLE.mapBy(p => _owner(views.get(p))).put("shared", _owner(result.note)),
      rejections' = rejections.set(person, rejections.get(person)
        + result.refused.exclude(_refused).size()),
    }
  }

  action init = all {
    _shared' = EMPTY,
    _snapshot' = PEOPLE.mapBy(_ => EMPTY),
    _pending' = PEOPLE.mapBy(_ => Nothing),
    _unheard' = Set(),
    _seen' = Set(),
    _refused' = Set(),
    _next' = 0,
    _previous' = EMPTY,
    _duplicate' = false,
    _deleteBy' = "",
    _deleteAccepted' = false,
    online' = PEOPLE.mapBy(_ => true),
    notes' = PEOPLE.mapBy(_ => Map()).put("shared", Map()),
    owners' = PEOPLE.mapBy(_ => Map()).put("shared", Map()),
    rejections' = PEOPLE.mapBy(_ => 0),
  }

  /// Write the note; one unsent edit per device represents competing intent.
  action write(person: Person, body: str): bool = all {
    _pending.get(person) == Nothing,
    _settle(person, Write({ id: _next, body: body }), online, _unheard, _next + 1),
  }

  /// Only the owner the device knows may delete the note.
  action deleteNote(person: Person): bool = all {
    _pending.get(person) == Nothing,
    _allowed(_snapshot.get(person), person, Delete(_next)),
    _settle(person, Delete(_next), online, _unheard, _next + 1),
  }

  /// The shared notes keep a write whose author has not heard back yet.
  action writeUnheard(person: Person, body: str): bool = all {
    online.get(person),
    _pending.get(person) == Nothing,
    _unheard == Set(),
    _settle(person, Write({ id: _next, body: body }), online, Set(person), _next + 1),
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

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet body = Set("milk", "eggs").oneOf()
    any {
      write(person, body), deleteNote(person), writeUnheard(person, body),
      hearBack(person), goOffline(person), goOnline(person),
    }
  }

  /// Every edit is either still waiting on its device or has been answered.
  val invNoLostEdits = {
    val kept = _seen.union(PEOPLE.map(p => _id(_pending.get(p))).filter(id => id >= 0))
    kept.size() == _next and kept.forall(id => 0 <= id and id < _next)
  }

  /// Repeating an answered edit preserves all later writing and deletion.
  val invDuplicatePreservesLaterEdits = _duplicate implies _shared == _previous

  /// An accepted deletion belonged to its author when it reached everyone.
  val invOnlyOwnerDeletes = _deleteAccepted implies
    (not(_previous.exists) or _previous.deleted or _previous.owner == _deleteBy)

  /// A connected device with every edit answered agrees with the shared notes.
  val invConnectedAgree = PEOPLE.forall(p =>
    (online.get(p) and _pending.get(p) == Nothing) implies
      (notes.get(p) == notes.get("shared") and owners.get(p) == owners.get("shared")))

  /// A live note has exactly the owner that wrote it, on every device.
  val invLiveNotesHaveOwners = notes.keys().forall(p =>
    notes.get(p).keys() == owners.get(p).keys()
      and owners.get(p).keys().forall(title => PEOPLE.contains(owners.get(p).get(title))))

  /// Returning connected devices never remain stuck with an unanswered edit.
  val invConnectedEditsAnswered = PEOPLE.forall(p =>
    (online.get(p) and not(_unheard.contains(p))) implies _pending.get(p) == Nothing)

  /// A refused edit is answered once and gives its author one notice.
  val invRefusalsCountOnce = _refused.subseteq(_seen)
    and PEOPLE.fold(0, (total, p) => total + rejections.get(p)) == _refused.size()
}
