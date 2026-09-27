// goal:works-offline:4 goal:always-true:2 goal:always-true:3
//
// Notes kept in step across people's devices.
//
// Alice, Bob and Carol each use a device that keeps its own copy of the
// notes, and there are the shared notes everyone's devices come to agree on.
// A person writes or deletes a note on their device and sees it there at
// once, online or not; only a note's owner (whoever wrote it last) may delete
// it, and a delete the device already knows is not allowed simply does not
// happen. Once a device is online and everything has settled, it shows
// exactly the shared notes. A device that is offline, or whose network has
// stalled, keeps its own writes and sends them, in order, once it is back. A
// write the app never hears back about, or whose save hits a hiccup, still
// counts once; a refused edit is undone and leaves its author a notice.
//
// None of the rest changes what anyone sees once things settle: the app
// crashing (even in the middle of a save), updating to another version,
// finding what it stored damaged, or having its data cleared; a device's
// clock being wrong; live updates being lost, repeated, garbled or stopping
// for a while; an outage that cuts everyone off for a while; and an edit the
// team makes to the shared notes without telling anyone.
//
// Each step is one action followed by everything settling — what a person
// sees after a quiet moment. The binding is
// `pkgs/sync-engine/tests/quint/note-replication.binding.ts`.
module note_replication {
  type Person = str
  type Title = str

  /** A note as kept: deletion is kept too, never forgotten. */
  type Note = { body: str, deleted: bool, owner: Person }
  type Notes = Title -> Note

  /** Something a person does to a note. */
  type Edit =
    | Write({ title: Title, body: str })
    | Delete(Title)

  /**
   * A device's writes that nobody has heard back about, keyed by write id
   * (ids only grow, so id order is the order they were made). Traces carry
   * no lists, so queues and logs are maps walked in key order.
   */
  type Unsent = int -> Edit

  /** One write the shared notes took in; a refused one changes nothing. */
  type Received = { person: Person, mid: int, edit: Edit, refused: bool }
  /** The order the shared notes took writes in → the write. */
  type History = int -> Received

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")
  pure val SHARED = "shared"
  /** Versions the app can update to (including back to the first). */
  pure val VERSIONS: Set[str] = Set("first", "colours", "tags", "fresh")
  /** Ways a save can fail once on the way before the app tries again. */
  pure val HICCUPS: Set[str] =
    Set("error", "slowDown", "cutOff", "garbled", "failedAfterKeeping")
  /** Ways what a device stored can be damaged. */
  pure val DAMAGE: Set[str] = Set("progress", "note", "fingerprint")
  /** Points in a save at which the app can crash. */
  pure val MOMENTS: Set[str] = Set("afterWriting", "afterSending")

  // ------------------------------------------------ what people see

  /** Live notes (title → body) in the shared notes and on each device. */
  var notes: str -> (Title -> str)
  /** Unacknowledged notices of refused edits, per person. */
  var rejections: Person -> int
  /** Who owns each live note, in the shared notes and on each device. */
  var owners: str -> (Title -> Person)
  /**
   * How many unsent edits each device holds: made on the device, not yet
   * taken in by the shared notes.
   */
  var unsent: Person -> int

  // ------------------------------------------------ bookkeeping

  var online: Person -> bool
  var _shared: Notes
  var _taken: History
  /** The last copy of the shared notes each device merged. */
  var _snapshot: Person -> Notes
  /** Each device's writes nobody has heard back about, in order. */
  var _pending: Person -> Unsent
  /** The device's network has stalled (it does not know it is cut off). */
  var _stalled: Set[Person]
  /** The app never heard back about a write; it owes a retry. */
  var _awaitingRetry: Person -> bool
  var _degradedLive: Set[Person]
  /** People with a second window of the app open on their device. */
  var _windows: Set[Person]
  var _nextMid: int

  // ------------------------------------------------ rules

  pure def _isLive(rows: Notes, title: Title): bool =
    rows.keys().contains(title) and not(rows.get(title).deleted)

  /** Only a live note's owner may delete it. */
  pure def _allowed(rows: Notes, actor: Person, edit: Edit): bool = match edit {
    | Write(_) => true
    | Delete(title) => not(_isLive(rows, title)) or rows.get(title).owner == actor
  }

  /** Writing takes ownership and brings a note back; deleting keeps the deletion. */
  pure def _apply(rows: Notes, actor: Person, edit: Edit): Notes = match edit {
    | Write(w) => rows.put(w.title, { body: w.body, deleted: false, owner: actor })
    | Delete(title) =>
      if (_isLive(rows, title)) rows.set(title, { ...rows.get(title), deleted: true })
      else rows
  }

  /** The queue's write ids, oldest first. */
  pure def _inOrder(queue: Unsent): List[int] =
    range(0, queue.keys().fold(0, (hi, mid) => if (mid + 1 > hi) mid + 1 else hi))
      .select(mid => queue.keys().contains(mid))

  /** A device's view: the merged copy with its own queue replayed on top. */
  pure def _rebase(rows: Notes, actor: Person, queue: Unsent): Notes =
    _inOrder(queue).foldl(rows, (acc, mid) =>
      if (_allowed(acc, actor, queue.get(mid))) _apply(acc, actor, queue.get(mid))
      else acc)

  pure def _live(rows: Notes): Title -> str =
    rows.keys().filter(t => not(rows.get(t).deleted)).mapBy(t => rows.get(t).body)

  pure def _owners(rows: Notes): Title -> Person =
    rows.keys().filter(t => not(rows.get(t).deleted)).mapBy(t => rows.get(t).owner)

  pure def _processed(log: History): Set[int] = log.keys().map(i => log.get(i).mid)

  pure def _logged(log: History, r: Received): History = log.put(log.keys().size(), r)

  /** The shared notes take each write at most once, refusing forbidden ones. */
  pure def _takeIn(
    st: { rows: Notes, log: History },
    person: Person,
    mid: int,
    edit: Edit
  ): { rows: Notes, log: History } =
    if (_processed(st.log).contains(mid)) st
    else if (_allowed(st.rows, person, edit)) {
      rows: _apply(st.rows, person, edit),
      log: _logged(st.log, { person: person, mid: mid, edit: edit, refused: false }),
    }
    else {
      rows: st.rows,
      log: _logged(st.log, { person: person, mid: mid, edit: edit, refused: true }),
    }

  pure def _drain(
    st: { rows: Notes, log: History },
    person: Person,
    queue: Unsent
  ): { rows: Notes, log: History } =
    _inOrder(queue).foldl(st, (acc, mid) => _takeIn(acc, person, mid, queue.get(mid)))

  // ------------------------------------------------ settling

  /**
   * After an action: each device in `uploads` that is online sends its
   * queue; those in `acked` hear back and drop it; every online device then
   * merges the shared notes. Offline and stalled devices see nothing.
   */
  action _settle(
    rows: Notes,
    log: History,
    queues: Person -> Unsent,
    conn: Person -> bool,
    uploads: Set[Person],
    acked: Set[Person]
  ): bool = {
    val st = uploads.filter(p => conn.get(p)).fold(
      { rows: rows, log: log },
      (acc, p) => _drain(acc, p, queues.get(p)))
    val queues2 = PEOPLE.mapBy(p =>
      if (conn.get(p) and acked.contains(p)) Map() else queues.get(p))
    val snap2 = PEOPLE.mapBy(p => if (conn.get(p)) st.rows else _snapshot.get(p))
    all {
      _shared' = st.rows,
      _taken' = st.log,
      online' = conn,
      _pending' = queues2,
      _snapshot' = snap2,
      notes' = PEOPLE.mapBy(p => _live(_rebase(snap2.get(p), p, queues2.get(p))))
        .put(SHARED, _live(st.rows)),
      owners' = PEOPLE.mapBy(p => _owners(_rebase(snap2.get(p), p, queues2.get(p))))
        .put(SHARED, _owners(st.rows)),
      unsent' = PEOPLE.mapBy(p => queues2.get(p).keys()
        .filter(mid => not(_processed(st.log).contains(mid))).size()),
      rejections' = PEOPLE.mapBy(p =>
        st.log.keys().filter(i => st.log.get(i).person == p and st.log.get(i).refused).size()),
    }
  }

  /** Nothing to record but the settling itself. */
  action _quiet(uploads: Set[Person]): bool = all {
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online, uploads, uploads),
  }

  def _deviceRows(p: Person): Notes = _rebase(_snapshot.get(p), p, _pending.get(p))
  def _heardBack(p: Person): bool = not(_awaitingRetry.get(p))
  def _noRetryOwed: bool = PEOPLE.forall(p => _heardBack(p))

  /**
   * Notes whose write the app has not heard back about. The app retries on
   * its own clock, so until `hearBack` nobody else changes such a note: the
   * retry landing sooner or later must not be visible.
   */
  def _awaited: Set[Title] =
    PEOPLE.filter(p => not(_heardBack(p))).fold(Set(), (acc, p) =>
      acc.union(_pending.get(p).keys().map(mid => match _pending.get(p).get(mid) {
        | Write(w) => w.title
        | Delete(t) => t
      })))
  def _nothingUnsent(p: Person): bool = _pending.get(p).keys().size() == 0
  /** Online, heard back about everything, with nothing waiting to be sent. */
  def _idle(p: Person): bool = online.get(p) and _heardBack(p) and _nothingUnsent(p)

  // ------------------------------------------------ actions

  action init = all {
    _shared' = Map(),
    _taken' = Map(),
    _snapshot' = PEOPLE.mapBy(_ => Map()),
    _pending' = PEOPLE.mapBy(_ => Map()),
    online' = PEOPLE.mapBy(_ => true),
    _stalled' = Set(),
    _awaitingRetry' = PEOPLE.mapBy(_ => false),
    _degradedLive' = Set(),
    _windows' = Set(),
    _nextMid' = 0,
    notes' = PEOPLE.mapBy(_ => Map()).put(SHARED, Map()),
    rejections' = PEOPLE.mapBy(_ => 0),
    owners' = PEOPLE.mapBy(_ => Map()).put(SHARED, Map()),
    unsent' = PEOPLE.mapBy(_ => 0),
  }

  /** A write the device accepts: queued, sent at once if online. */
  action _write(person: Person, edit: Edit): bool = all {
    _nextMid' = _nextMid + 1,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(
      _shared, _taken,
      _pending.set(person, _pending.get(person).put(_nextMid, edit)),
      online, Set(person), Set(person)
    ),
  }

  /** Write a note, taking ownership (and bringing it back if deleted). */
  action write(person: Person, title: Title, body: str): bool = all {
    _heardBack(person),
    not(_awaited.contains(title)),
    _write(person, Write({ title: title, body: body })),
  }

  /**
   * Delete a note. A delete the device already knows is not allowed (the
   * note is someone else's) does not happen at all.
   */
  action deleteNote(person: Person, title: Title): bool = all {
    _heardBack(person),
    not(_awaited.contains(title)),
    if (_allowed(_deviceRows(person), person, Delete(title)))
      _write(person, Delete(title))
    else
      _quiet(Set()),
  }

  /**
   * Write a note online, but the app never hears back: the shared notes
   * have it, the device still keeps it queued (and shows it) until
   * `hearBack`. At most one retry is owed at a time: independent retry
   * timers race, and a trace must pin which lands first.
   */
  action writeUnheard(person: Person, title: Title, body: str): bool = all {
    _idle(person),
    _noRetryOwed,
    _nextMid' = _nextMid + 1,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry.set(person, true),
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(
      _shared, _taken,
      _pending.set(person, Map(_nextMid -> Write({ title: title, body: body }))),
      online, Set(person), Set()
    ),
  }

  /** The app sends its queue again and hears back; the write counts once. */
  action hearBack(person: Person): bool = all {
    not(_heardBack(person)),
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry.set(person, false),
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online, Set(person), Set(person)),
  }

  /**
   * Write a note online whose save hits a hiccup on the way (`hiccup`); the
   * app tries again until it hears back, and the note counts once.
   */
  action writeThroughHiccup(person: Person, title: Title, body: str, hiccup: str): bool = all {
    _idle(person),
    _noRetryOwed,
    HICCUPS.contains(hiccup),
    _write(person, Write({ title: title, body: body })),
  }

  action goOffline(person: Person): bool = all {
    online.get(person),
    _heardBack(person),
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online.set(person, false), Set(), Set()),
  }

  action goOnline(person: Person): bool = all {
    not(online.get(person)),
    not(_stalled.contains(person)),
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online.set(person, true), Set(person), Set(person)),
  }

  /** The device's network stops carrying anything; the app does not know. */
  action networkStalls(person: Person): bool = all {
    online.get(person),
    _heardBack(person),
    _nextMid' = _nextMid,
    _stalled' = _stalled.union(Set(person)),
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online.set(person, false), Set(), Set()),
  }

  /** The stalled network carries again; what waited on the device is sent. */
  action networkRecovers(person: Person): bool = all {
    _stalled.contains(person),
    _noRetryOwed,
    _nextMid' = _nextMid,
    _stalled' = _stalled.exclude(Set(person)),
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online.set(person, true), Set(person), Set(person)),
  }

  /** The app crashes and reopens; its notes and queue survive. */
  action crashAndReopen(person: Person): bool = all {
    online.get(person),
    _heardBack(person),
    _quiet(Set(person)),
  }

  /**
   * The person writes a note and the app crashes at `moment` of saving it,
   * then reopens: the note is kept, and counts once.
   */
  action crashWhileSaving(person: Person, title: Title, body: str, moment: str): bool = all {
    _idle(person),
    _noRetryOwed,
    MOMENTS.contains(moment),
    _write(person, Write({ title: title, body: body })),
  }

  /**
   * The app updates to `version` (or goes back to an earlier one).
   *
   * Open question: whether an update that fetches every note again keeps
   * the person's unacknowledged notices. The glossary says a notice stays
   * until acknowledged; today such an update drops it. Until that is
   * settled, the model updates only an app with no notice waiting.
   */
  action appUpdates(person: Person, version: str): bool = all {
    _idle(person),
    VERSIONS.contains(version),
    version == "fresh" implies rejections.get(person) == 0,
    _quiet(Set(person)),
  }

  /**
   * What the device stored is damaged (`damage`); the app notices and gets
   * the notes back from everyone else. Nothing was waiting to be sent.
   */
  action appDataDamaged(person: Person, damage: str): bool = all {
    _idle(person),
    DAMAGE.contains(damage),
    _quiet(Set(person)),
  }

  /**
   * The app's data is cleared; it gets the notes back from everyone else.
   * (Same open question as `appUpdates`: clearing drops unacknowledged
   * notices today, so the model clears only with none waiting.)
   */
  action appDataCleared(person: Person): bool = all {
    _idle(person),
    rejections.get(person) == 0,
    _quiet(Set(person)),
  }

  /** The device's clock runs a day ahead or behind; nothing changes. */
  action clockIsWrong(person: Person): bool = all {
    online.get(person),
    _noRetryOwed,
    _quiet(Set()),
  }

  /** The app goes to the background for a while and comes back. */
  action appBackgrounded(person: Person): bool = all {
    online.get(person),
    _noRetryOwed,
    _quiet(Set()),
  }

  /** The person's sign-in expires; the app signs in again on its own. */
  action signInExpires(person: Person): bool = all {
    _idle(person),
    _noRetryOwed,
    _quiet(Set()),
  }

  /** A second window of the app opens on the person's device. */
  action secondWindow(person: Person): bool = all {
    _idle(person),
    _noRetryOwed,
    not(_windows.contains(person)),
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows.union(Set(person)),
    _settle(_shared, _taken, _pending, online, Set(), Set()),
  }

  /**
   * Refreshing the person's notes hits a hiccup once (`hiccup`); the app
   * tries again on its own.
   */
  action refreshHiccup(person: Person, hiccup: str): bool = all {
    _idle(person),
    _noRetryOwed,
    HICCUPS.contains(hiccup),
    _quiet(Set()),
  }

  /** The person's connection starts delaying what it carries, unevenly and out of order. */
  action connectionFlaky(person: Person): bool = all {
    _idle(person),
    _noRetryOwed,
    _quiet(Set()),
  }

  /** The person's live updates start being lost, repeated and reordered. */
  action liveUpdatesDegrade(person: Person): bool = all {
    not(_degradedLive.contains(person)),
    _noRetryOwed,
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive.union(Set(person)),
    _windows' = _windows,
    _settle(_shared, _taken, _pending, online, Set(), Set()),
  }

  /** The next live updates arrive garbled or twice. */
  action liveUpdatesGarbled: bool = all {
    _noRetryOwed,
    _quiet(Set()),
  }

  /** Live updates stop for everyone for a while, then start again. */
  action liveUpdatesPause: bool = all {
    _noRetryOwed,
    _quiet(Set()),
  }

  /**
   * An outage cuts every device off for a while; once it ends, every online
   * device sends what waited on it.
   */
  action outage: bool = all {
    _noRetryOwed,
    _quiet(PEOPLE.filter(p => online.get(p))),
  }

  /** The team edits a note in the shared notes, telling nobody. */
  action teamEdit(title: Title, body: str): bool = all {
    _shared.keys().contains(title),
    not(_awaited.contains(title)),
    _nextMid' = _nextMid,
    _stalled' = _stalled,
    _awaitingRetry' = _awaitingRetry,
    _degradedLive' = _degradedLive,
    _windows' = _windows,
    _settle(
      _shared.set(title, { ..._shared.get(title), body: body }),
      _taken, _pending, online, Set(), Set()
    ),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet title = Set("n1", "n2").oneOf()
    nondet body = Set("x", "y").oneOf()
    nondet version = VERSIONS.oneOf()
    nondet hiccup = HICCUPS.oneOf()
    nondet damage = DAMAGE.oneOf()
    nondet moment = MOMENTS.oneOf()
    any {
      write(person, title, body),
      deleteNote(person, title),
      writeUnheard(person, title, body),
      hearBack(person),
      writeThroughHiccup(person, title, body, hiccup),
      goOffline(person),
      goOnline(person),
      networkStalls(person),
      networkRecovers(person),
      crashAndReopen(person),
      crashWhileSaving(person, title, body, moment),
      appUpdates(person, version),
      appDataDamaged(person, damage),
      appDataCleared(person),
      clockIsWrong(person),
      liveUpdatesDegrade(person),
      liveUpdatesGarbled,
      liveUpdatesPause,
      outage,
      teamEdit(title, body),
      appBackgrounded(person),
      signInExpires(person),
      secondWindow(person),
      refreshHiccup(person, hiccup),
      connectionFlaky(person),
    }
  }

  // ------------------------------------------------ invariants

  def _at(i: int): Received = _taken.get(i)

  /** Nothing counts twice: no write is taken in twice. */
  val invNoDoubleApply: bool =
    _taken.keys().forall(i => _taken.keys().forall(j =>
      i < j implies _at(i).mid != _at(j).mid))

  /** Each device's writes reach the shared notes in the order they were made. */
  val invInOrderPerPerson: bool =
    _taken.keys().forall(i => _taken.keys().forall(j =>
      (i < j and _at(i).person == _at(j).person) implies _at(i).mid < _at(j).mid))

  /** Nothing is lost: every write is taken in or still queued. */
  val invNoLostWrites: bool = {
    val done = _processed(_taken)
    0.to(_nextMid - 1).forall(mid =>
      done.contains(mid) or PEOPLE.exists(p => _pending.get(p).keys().contains(mid)))
  }

  /** Deletion is kept: a written note is never forgotten by the shared notes. */
  val invTombstonesKept: bool =
    _taken.keys().forall(i => match _at(i).edit {
      | Write(w) => _at(i).refused or _shared.keys().contains(w.title)
      | Delete(_) => true
    })

  /** Only a forbidden delete is refused. */
  val invOnlyForbiddenRefused: bool =
    _taken.keys().forall(i => _at(i).refused implies match _at(i).edit {
      | Write(_) => false
      | Delete(_) => true
    })

  /** Everyone agrees: a settled online device shows the shared notes. */
  val invOnlineAgree: bool =
    PEOPLE.forall(p => (online.get(p) and _heardBack(p)) implies
      (_nothingUnsent(p) and notes.get(p) == notes.get(SHARED)))

  /** An owed retry is for a write the shared notes already have. */
  val invRetryIsDuplicate: bool =
    PEOPLE.forall(p => not(_heardBack(p)) implies
      _pending.get(p).keys().subseteq(_processed(_taken)))

  /** Once everyone is back online, every write has been taken in. */
  val invHealConverges: bool = {
    val healed = PEOPLE.fold({ rows: _shared, log: _taken }, (st, p) =>
      _drain(st, p, _pending.get(p)))
    _processed(healed.log) == 0.to(_nextMid - 1)
  }
}
