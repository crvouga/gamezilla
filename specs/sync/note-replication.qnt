// goal:works-offline:4 goal:always-true:2 goal:always-true:3
//
// Notes kept in step across people's devices.
//
// Alice, Bob and Carol each use a device that keeps its own copy of their
// notes and folders, and there are the shared notes everyone's devices come
// to agree on. A person writes or deletes a note, or a folder, on their
// device and sees it there at once, online or not; only the owner (whoever
// wrote it last) may delete it, and a delete the device already knows is not
// allowed simply does not happen. People create shared spaces, join them and
// leave them; joining a shared space that does not exist is refused. Once a
// device is online and everything has settled, it shows exactly the shared
// notes. A device that is offline, whose network has stalled, or that cannot
// send for a while, keeps its own edits and sends them, in order, once it can. An edit
// the app never hears back about, or whose save hits a hiccup, still counts
// once; a refused edit is undone and leaves its author a notice, which stays
// until acknowledged. An unsent edit that is damaged on the device is refused
// the same way. A person signed out elsewhere loses what the device kept for
// them, unsent edits and notices included, and signs back in to the shared
// notes. A device too full to save a note refuses it on the spot.
//
// None of the rest changes what anyone sees once things settle: the app
// crashing (even in the middle of a save), failing to open once, updating to
// another version or having to, finding what it kept damaged, or having its
// data cleared (unsent edits still show and are sent); a device's clock being
// wrong; live updates being lost, repeated, garbled, cut off or stopping for
// a while; an outage; the team tidying up; and edits or notes the team makes
// in the shared notes without telling anyone.
//
// Each step is one action followed by everything settling — what a person
// sees after a quiet moment. The binding is
// `pkgs/sync-engine/tests/quint/note-replication.binding.ts`.
module note_replication {
  type Person = str
  type Title = str
  type SpaceId = str

  /** A note or folder as kept: deletion is kept too, never forgotten. */
  type Note = { body: str, deleted: bool, owner: Person }
  type Notes = Title -> Note
  type Membership = { space: SpaceId, person: Person }

  /** Everything a copy holds: notes, folders, shared spaces, who is in them. */
  type Shared = {
    notes: Notes,
    folders: Notes,
    spaces: SpaceId -> Person,
    members: Set[Membership],
  }

  /** Something a person does. */
  type Edit =
    | Write({ title: Title, body: str })
    | Delete(Title)
    | WriteFolder({ title: Title, body: str })
    | DeleteFolder(Title)
    | CreateSpace(SpaceId)
    | JoinSpace(SpaceId)
    | LeaveSpace(SpaceId)

  /**
   * A device's edits that have not reached the shared notes, keyed by edit id
   * (ids only grow, so id order is the order they were made). Traces carry
   * no lists, so queues and logs are maps walked in key order.
   */
  type Unsent = int -> Edit

  /** One edit the shared notes took in; a refused one changes nothing. */
  type Received = { person: Person, mid: int, edit: Edit, refused: bool }
  /** The order the shared notes took edits in → the edit. */
  type History = int -> Received

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")
  pure val SHARED = "shared"
  /** Whoever the team's own notes belong to. */
  pure val TEAM = "team"
  pure val EMPTY: Shared = { notes: Map(), folders: Map(), spaces: Map(), members: Set() }
  /** Versions the app can update to (including back to the first). */
  pure val VERSIONS: Set[str] = Set("first", "colours", "tags", "fresh")
  /** Ways a save or refresh can fail once on the way before the app tries again. */
  pure val HICCUPS: Set[str] =
    Set("error", "slowDown", "cutOff", "garbled", "failedAfterKeeping")
  /** Ways what a device kept can be damaged. */
  pure val DAMAGE: Set[str] = Set("progress", "note", "fingerprint")
  /** Points in a save at which the app can crash. */
  pure val MOMENTS: Set[str] = Set("afterWriting", "afterSending")
  /** Ways a device can be too full to save. */
  pure val FULLNESS: Set[str] = Set("full", "fullMidWrite")

  // ------------------------------------------------ what people see

  /** Live notes (title → body) in the shared notes and on each device. */
  var notes: str -> (Title -> str)
  /** Who owns each live note and folder, in the shared notes and on each device. */
  var owners: str -> (Title -> Person)
  /** Live folders (id → name) in the shared notes and on each device. */
  var folders: str -> (Title -> str)
  /** Who is in each shared space, as everyone keeps it. */
  var members: SpaceId -> Set[Person]
  /** Unacknowledged notices of refused edits, on each person's device. */
  var rejections: Person -> int
  /**
   * How many unsent edits each device holds: made on the device, not yet
   * taken in by the shared notes.
   */
  var unsent: Person -> int

  // ------------------------------------------------ bookkeeping

  var online: Person -> bool
  var _shared: Shared
  var _taken: History
  /** The last copy of the shared notes each device merged. */
  var _snapshot: Person -> Shared
  /** Each device's unsent edits, in order. */
  var _pending: Person -> Unsent
  var _book: {
    /** The device's network has stalled (it does not know it is cut off). */
    stalled: Set[Person],
    /** The app never heard back about an edit; it owes a retry. */
    awaitingRetry: Set[Person],
    degradedLive: Set[Person],
    /** Live updates to the device are cut off. */
    liveCut: Set[Person],
    /** People with a second window of the app open on their device. */
    windows: Set[Person],
    /** Unsent edits damaged on their device (refused when they arrive). */
    damaged: Set[int],
    /** Unsent edits dropped when their author was signed out elsewhere. */
    discarded: Set[int],
    /** History entries whose notice is gone from its author's device. */
    dismissed: Set[int],
    nextMid: int,
  }

  // ------------------------------------------------ rules

  pure def _isLive(rows: Notes, title: Title): bool =
    rows.keys().contains(title) and not(rows.get(title).deleted)

  pure def _ownerMayDelete(rows: Notes, actor: Person, title: Title): bool =
    not(_isLive(rows, title)) or rows.get(title).owner == actor

  /**
   * What a copy allows. Only the owner may delete; joining needs the space
   * to exist, which only the shared notes can tell (a device lets it through).
   */
  pure def _allowed(k: Shared, actor: Person, edit: Edit, atShared: bool): bool = match edit {
    | Delete(title) => _ownerMayDelete(k.notes, actor, title)
    | DeleteFolder(title) => _ownerMayDelete(k.folders, actor, title)
    | JoinSpace(s) => not(atShared) or k.spaces.keys().contains(s)
    | _ => true
  }

  pure def _deleted(rows: Notes, title: Title): Notes =
    if (_isLive(rows, title)) rows.set(title, { ...rows.get(title), deleted: true })
    else rows

  /** Writing takes ownership and brings a row back; deleting keeps the deletion. */
  pure def _apply(k: Shared, actor: Person, edit: Edit): Shared = match edit {
    | Write(w) => { ...k, notes: k.notes.put(w.title, { body: w.body, deleted: false, owner: actor }) }
    | Delete(title) => { ...k, notes: _deleted(k.notes, title) }
    | WriteFolder(w) => { ...k, folders: k.folders.put(w.title, { body: w.body, deleted: false, owner: actor }) }
    | DeleteFolder(title) => { ...k, folders: _deleted(k.folders, title) }
    | CreateSpace(s) => {
        ...k,
        spaces: k.spaces.put(s, actor),
        members: k.members.union(Set({ space: s, person: actor })),
      }
    | JoinSpace(s) => { ...k, members: k.members.union(Set({ space: s, person: actor })) }
    | LeaveSpace(s) => { ...k, members: k.members.exclude(Set({ space: s, person: actor })) }
  }

  /** The queue's edit ids, oldest first. */
  pure def _inOrder(queue: Unsent): List[int] =
    range(0, queue.keys().fold(0, (hi, mid) => if (mid + 1 > hi) mid + 1 else hi))
      .select(mid => queue.keys().contains(mid))

  /** A device's view: the merged copy with its own queue replayed on top. */
  pure def _rebase(k: Shared, actor: Person, queue: Unsent): Shared =
    _inOrder(queue).foldl(k, (acc, mid) =>
      if (_allowed(acc, actor, queue.get(mid), false)) _apply(acc, actor, queue.get(mid))
      else acc)

  pure def _live(rows: Notes): Title -> str =
    rows.keys().filter(t => not(rows.get(t).deleted)).mapBy(t => rows.get(t).body)

  pure def _owners(rows: Notes): Title -> Person =
    rows.keys().filter(t => not(rows.get(t).deleted)).mapBy(t => rows.get(t).owner)

  /** Owners of live notes and folders (their ids never clash). */
  pure def _ownersOf(k: Shared): Title -> Person = {
    val n = _owners(k.notes)
    val f = _owners(k.folders)
    n.keys().union(f.keys()).mapBy(t => if (n.keys().contains(t)) n.get(t) else f.get(t))
  }

  pure def _members(k: Shared): SpaceId -> Set[Person] =
    k.spaces.keys().mapBy(s => k.members.filter(m => m.space == s).map(m => m.person))

  pure def _processed(log: History): Set[int] = log.keys().map(i => log.get(i).mid)

  pure def _logged(log: History, r: Received): History = log.put(log.keys().size(), r)

  /**
   * The shared notes take each edit at most once, refusing a forbidden or
   * damaged one.
   */
  pure def _takeIn(
    st: { k: Shared, log: History },
    damaged: Set[int],
    person: Person,
    mid: int,
    edit: Edit
  ): { k: Shared, log: History } =
    if (_processed(st.log).contains(mid)) st
    else if (not(damaged.contains(mid)) and _allowed(st.k, person, edit, true)) {
      k: _apply(st.k, person, edit),
      log: _logged(st.log, { person: person, mid: mid, edit: edit, refused: false }),
    }
    else {
      k: st.k,
      log: _logged(st.log, { person: person, mid: mid, edit: edit, refused: true }),
    }

  pure def _drain(
    st: { k: Shared, log: History },
    damaged: Set[int],
    person: Person,
    queue: Unsent
  ): { k: Shared, log: History } =
    _inOrder(queue).foldl(st, (acc, mid) => _takeIn(acc, damaged, person, mid, queue.get(mid)))

  // ------------------------------------------------ settling

  /**
   * After an action: each device in `uploads` that is online sends its queue
   * and hears back; every online device then merges the shared notes.
   * Offline and stalled devices see nothing.
   */
  action _settle(
    k: Shared,
    log: History,
    queues: Person -> Unsent,
    conn: Person -> bool,
    snaps: Person -> Shared,
    book: {
      stalled: Set[Person], awaitingRetry: Set[Person], degradedLive: Set[Person],
      liveCut: Set[Person], windows: Set[Person],
      damaged: Set[int], discarded: Set[int], dismissed: Set[int], nextMid: int,
    },
    uploads: Set[Person],
    acked: Set[Person]
  ): bool = {
    val senders = uploads.filter(p => conn.get(p))
    val st = senders.fold({ k: k, log: log }, (acc, p) =>
      _drain(acc, book.damaged, p, queues.get(p)))
    val queues2 = PEOPLE.mapBy(p =>
      if (senders.contains(p) and acked.contains(p)) Map() else queues.get(p))
    val snap2 = PEOPLE.mapBy(p => if (conn.get(p)) st.k else snaps.get(p))
    val views = PEOPLE.mapBy(p => _rebase(snap2.get(p), p, queues2.get(p)))
    all {
      _shared' = st.k,
      _taken' = st.log,
      online' = conn,
      _pending' = queues2,
      _snapshot' = snap2,
      _book' = book,
      notes' = PEOPLE.mapBy(p => _live(views.get(p).notes)).put(SHARED, _live(st.k.notes)),
      owners' = PEOPLE.mapBy(p => _ownersOf(views.get(p))).put(SHARED, _ownersOf(st.k)),
      folders' = PEOPLE.mapBy(p => _live(views.get(p).folders)).put(SHARED, _live(st.k.folders)),
      members' = _members(st.k),
      unsent' = PEOPLE.mapBy(p => queues2.get(p).keys()
        .filter(mid => not(_processed(st.log).contains(mid))).size()),
      rejections' = PEOPLE.mapBy(p => st.log.keys().filter(i =>
        st.log.get(i).person == p and st.log.get(i).refused
          and not(book.dismissed.contains(i))).size()),
    }
  }

  /** Settle with nothing changed but `book`; `uploads` send and hear back. */
  action _quietWith(book: {
      stalled: Set[Person], awaitingRetry: Set[Person], degradedLive: Set[Person],
      liveCut: Set[Person], windows: Set[Person],
      damaged: Set[int], discarded: Set[int], dismissed: Set[int], nextMid: int,
    }, uploads: Set[Person]): bool =
    _settle(_shared, _taken, _pending, online, _snapshot, book, uploads, uploads)

  /** Nothing to record but the settling itself. */
  action _quiet(uploads: Set[Person]): bool = _quietWith(_book, uploads)

  def _device(p: Person): Shared = _rebase(_snapshot.get(p), p, _pending.get(p))
  def _heardBack(p: Person): bool = not(_book.awaitingRetry.contains(p))
  def _noRetryOwed: bool = _book.awaitingRetry == Set()
  def _nothingUnsent(p: Person): bool = _pending.get(p).keys().size() == 0
  def _noCuts: bool = _book.liveCut == Set()
  def _plain(p: Person): bool =
    not(_book.liveCut.contains(p)) and not(_book.stalled.contains(p))
  /** Online, heard back about everything, nothing waiting. */
  def _idle(p: Person): bool =
    online.get(p) and _heardBack(p) and _nothingUnsent(p)

  pure def _editTitle(edit: Edit): str = match edit {
    | Write(w) => w.title
    | Delete(t) => t
    | WriteFolder(w) => w.title
    | DeleteFolder(t) => t
    | CreateSpace(s) => s
    | JoinSpace(s) => s
    | LeaveSpace(s) => s
  }

  /**
   * What an edit the app has not heard back about touches. The app retries
   * on its own clock, so until `hearBack` nobody else changes it: the retry
   * landing sooner or later must not be visible.
   */
  def _awaited: Set[str] =
    PEOPLE.filter(p => not(_heardBack(p))).fold(Set(), (acc, p) =>
      acc.union(_pending.get(p).keys().map(mid => _editTitle(_pending.get(p).get(mid)))))

  // ------------------------------------------------ actions

  action init = all {
    _shared' = EMPTY,
    _taken' = Map(),
    _snapshot' = PEOPLE.mapBy(_ => EMPTY),
    _pending' = PEOPLE.mapBy(_ => Map()),
    online' = PEOPLE.mapBy(_ => true),
    _book' = {
      stalled: Set(), awaitingRetry: Set(), degradedLive: Set(), liveCut: Set(),
      windows: Set(), damaged: Set(), discarded: Set(),
      dismissed: Set(), nextMid: 0,
    },
    notes' = PEOPLE.mapBy(_ => Map()).put(SHARED, Map()),
    owners' = PEOPLE.mapBy(_ => Map()).put(SHARED, Map()),
    folders' = PEOPLE.mapBy(_ => Map()).put(SHARED, Map()),
    members' = Map(),
    rejections' = PEOPLE.mapBy(_ => 0),
    unsent' = PEOPLE.mapBy(_ => 0),
  }

  /** An edit the device accepts: queued, sent at once if it can send. */
  action _edit(person: Person, edit: Edit): bool = all {
    _heardBack(person),
    not(_awaited.contains(_editTitle(edit))),
    if (_allowed(_device(person), person, edit, false))
      _settle(
        _shared, _taken,
        _pending.set(person, _pending.get(person).put(_book.nextMid, edit)),
        online, _snapshot, { ..._book, nextMid: _book.nextMid + 1 },
        Set(person), Set(person)
      )
    else
      _quiet(Set()),
  }

  /** Write a note, taking ownership (and bringing it back if deleted). */
  action write(person: Person, title: Title, body: str): bool =
    _edit(person, Write({ title: title, body: body }))

  /**
   * Delete a note. A delete the device already knows is not allowed (the
   * note is someone else's) does not happen at all.
   */
  action deleteNote(person: Person, title: Title): bool = _edit(person, Delete(title))

  /** Make or rename a folder, taking ownership. */
  action writeFolder(person: Person, folder: Title, body: str): bool =
    _edit(person, WriteFolder({ title: folder, body: body }))

  /** Delete a folder; only its owner may. */
  action deleteFolder(person: Person, folder: Title): bool =
    _edit(person, DeleteFolder(folder))

  action createSpace(person: Person, space: SpaceId): bool =
    _edit(person, CreateSpace(space))

  /** Join a shared space; refused, with a notice, if it does not exist. */
  action joinSpace(person: Person, space: SpaceId): bool =
    _edit(person, JoinSpace(space))

  action leaveSpace(person: Person, space: SpaceId): bool =
    _edit(person, LeaveSpace(space))

  /**
   * The person tries to write a note while the device is too full to save
   * it (`fullness`): it is refused on the spot and nothing changes.
   */
  action writeWhileFull(person: Person, title: Title, body: str, fullness: str): bool = all {
    _heardBack(person),
    FULLNESS.contains(fullness),
    not(_awaited.contains(title)),
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
    _settle(
      _shared, _taken,
      _pending.set(person, Map(_book.nextMid -> Write({ title: title, body: body }))),
      online, _snapshot,
      { ..._book, nextMid: _book.nextMid + 1, awaitingRetry: Set(person) },
      Set(person), Set()
    ),
  }

  /** The app sends its queue again and hears back; the edit counts once. */
  action hearBack(person: Person): bool = all {
    not(_heardBack(person)),
    _quietWith({ ..._book, awaitingRetry: _book.awaitingRetry.exclude(Set(person)) }, Set(person)),
  }

  /**
   * Write a note online whose save hits a hiccup on the way (`hiccup`); the
   * app tries again until it hears back, and the note counts once.
   */
  action writeThroughHiccup(person: Person, title: Title, body: str, hiccup: str): bool = all {
    _idle(person),
    _noRetryOwed,
    HICCUPS.contains(hiccup),
    write(person, title, body),
  }

  action goOffline(person: Person): bool = all {
    online.get(person),
    _heardBack(person),
    not(_book.stalled.contains(person)),
    _settle(_shared, _taken, _pending, online.set(person, false), _snapshot, _book, Set(), Set()),
  }

  action goOnline(person: Person): bool = all {
    not(online.get(person)),
    not(_book.stalled.contains(person)),
    _settle(_shared, _taken, _pending, online.set(person, true), _snapshot, _book,
      Set(person), Set(person)),
  }

  /** The device's network stops carrying anything; the app does not know. */
  action networkStalls(person: Person): bool = all {
    online.get(person),
    _heardBack(person),
    _plain(person),
    _settle(_shared, _taken, _pending, online.set(person, false), _snapshot,
      { ..._book, stalled: _book.stalled.union(Set(person)) }, Set(), Set()),
  }

  /** The stalled network carries again; what waited on the device is sent. */
  action networkRecovers(person: Person): bool = all {
    _book.stalled.contains(person),
    _noRetryOwed,
    _settle(_shared, _taken, _pending, online.set(person, true), _snapshot,
      { ..._book, stalled: _book.stalled.exclude(Set(person)) }, Set(person), Set(person)),
  }

  /**
   * The device cannot send or refresh for a while (live updates still
   * arrive); the person writes a note meanwhile, which waits on the device
   * and is sent once the device can send again.
   */
  action writeWhileSavesCut(person: Person, title: Title, body: str): bool = all {
    _idle(person),
    _noRetryOwed,
    _plain(person),
    write(person, title, body),
  }

  /** Live updates to the device are cut off; it still refreshes on its own. */
  action liveCutOff(person: Person): bool = all {
    online.get(person),
    _noRetryOwed,
    _plain(person),
    _quietWith({ ..._book, liveCut: _book.liveCut.union(Set(person)) }, Set()),
  }

  action liveRestored(person: Person): bool = all {
    _book.liveCut.contains(person),
    _noRetryOwed,
    _quietWith({ ..._book, liveCut: _book.liveCut.exclude(Set(person)) }, Set()),
  }

  /** The app crashes and reopens; its notes and queue survive. */
  action crashAndReopen(person: Person): bool = all {
    online.get(person),
    _heardBack(person),
    _quiet(Set(person)),
  }

  /** The app fails to open once, then opens. */
  action appFailsToOpen(person: Person): bool = all {
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
    write(person, title, body),
  }

  /**
   * The app updates to `version` (or goes back to an earlier one). Notes,
   * unsent edits and notices all stay.
   */
  action appUpdates(person: Person, version: str): bool = all {
    _idle(person),
    VERSIONS.contains(version),
    _quiet(Set(person)),
  }

  /**
   * The app is told it must update before it may sync, updates and reopens:
   * what waited on it is sent then.
   */
  action appMustUpdate(person: Person): bool = all {
    _heardBack(person),
    _plain(person),
    not(_book.windows.contains(person)),
    _settle(_shared, _taken, _pending, online.set(person, true), _snapshot, _book,
      Set(person), Set(person)),
  }

  /**
   * What the device kept is damaged (`damage`); the app notices and gets the
   * notes back from everyone else. Nothing was waiting to be sent.
   */
  action appDataDamaged(person: Person, damage: str): bool = all {
    _idle(person),
    DAMAGE.contains(damage),
    _quiet(Set(person)),
  }

  /**
   * The oldest unsent edit on an offline device is damaged; when the app
   * reopens online it is refused, with a notice, and the rest are sent.
   */
  action unsentEditDamaged(person: Person): bool = all {
    not(online.get(person)),
    _heardBack(person),
    _plain(person),
    not(_book.windows.contains(person)),
    not(_nothingUnsent(person)),
    val oldest = _inOrder(_pending.get(person))[0]
    _settle(_shared, _taken, _pending, online.set(person, true), _snapshot,
      { ..._book, damaged: _book.damaged.union(Set(oldest)) }, Set(person), Set(person)),
  }

  /**
   * The app's data is cleared. Unsent edits still show and are sent, and
   * notices stay; an online device gets the notes back from everyone else,
   * an offline one shows only its unsent edits until it is back.
   */
  action appDataCleared(person: Person): bool = all {
    _heardBack(person),
    _plain(person),
    not(_book.windows.contains(person)),
    _settle(_shared, _taken, _pending, online, _snapshot.set(person, EMPTY), _book,
      Set(person), Set(person)),
  }

  /**
   * The person is signed out elsewhere and signs back in on the device. It
   * forgets what it kept for them, unsent edits and notices included, and
   * shows the shared notes.
   */
  action signedOutElsewhere(person: Person): bool = all {
    _noRetryOwed,
    _plain(person),
    not(_book.windows.contains(person)),
    val dropped = _pending.get(person).keys()
    val theirs = _taken.keys().filter(i => _taken.get(i).person == person)
    _settle(_shared, _taken, _pending.set(person, Map()), online.set(person, true),
      _snapshot.set(person, EMPTY),
      { ..._book, discarded: _book.discarded.union(dropped), dismissed: _book.dismissed.union(theirs) },
      Set(), Set()),
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
    _plain(person),
    not(_book.windows.contains(person)),
    _quietWith({ ..._book, windows: _book.windows.union(Set(person)) }, Set()),
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
    _plain(person),
    _quiet(Set()),
  }

  /** The person's live updates start being lost, repeated and reordered. */
  action liveUpdatesDegrade(person: Person): bool = all {
    not(_book.degradedLive.contains(person)),
    _noRetryOwed,
    _plain(person),
    _quietWith({ ..._book, degradedLive: _book.degradedLive.union(Set(person)) }, Set()),
  }

  /** The next live updates arrive garbled or twice. */
  action liveUpdatesGarbled: bool = all {
    _noRetryOwed,
    _quiet(Set()),
  }

  /** The next live update is lost on the way. */
  action liveUpdateLost: bool = all {
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
    _noCuts,
    _quiet(PEOPLE.filter(p => online.get(p))),
  }

  /** The team tidies up what the shared notes keep about edits long heard back. */
  action teamTidiesUp: bool = all {
    _noRetryOwed,
    _quiet(Set()),
  }

  /** The team edits a note in the shared notes, telling nobody. */
  action teamEdit(title: Title, body: str): bool = all {
    _shared.notes.keys().contains(title),
    not(_awaited.contains(title)),
    _settle(
      { ..._shared, notes: _shared.notes.set(title, { ..._shared.notes.get(title), body: body }) },
      _taken, _pending, online, _snapshot, _book, Set(), Set()
    ),
  }

  /** The team adds a note of its own to the shared notes, telling nobody. */
  action teamAddsNote(title: Title, body: str): bool = all {
    not(_shared.notes.keys().contains(title)),
    not(_awaited.contains(title)),
    _settle(
      { ..._shared, notes: _shared.notes.put(title, { body: body, deleted: false, owner: TEAM }) },
      _taken, _pending, online, _snapshot, _book, Set(), Set()
    ),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet title = Set("n1", "n2").oneOf()
    nondet folder = Set("f1").oneOf()
    nondet space = Set("s1", "s2").oneOf()
    nondet body = Set("x", "y").oneOf()
    nondet version = VERSIONS.oneOf()
    nondet hiccup = HICCUPS.oneOf()
    nondet damage = DAMAGE.oneOf()
    nondet moment = MOMENTS.oneOf()
    nondet fullness = FULLNESS.oneOf()
    any {
      write(person, title, body),
      deleteNote(person, title),
      writeFolder(person, folder, body),
      deleteFolder(person, folder),
      createSpace(person, space),
      joinSpace(person, space),
      leaveSpace(person, space),
      writeWhileFull(person, title, body, fullness),
      writeUnheard(person, title, body),
      hearBack(person),
      writeThroughHiccup(person, title, body, hiccup),
      goOffline(person),
      goOnline(person),
      networkStalls(person),
      networkRecovers(person),
      writeWhileSavesCut(person, title, body),
      liveCutOff(person),
      liveRestored(person),
      crashAndReopen(person),
      appFailsToOpen(person),
      crashWhileSaving(person, title, body, moment),
      appUpdates(person, version),
      appMustUpdate(person),
      appDataDamaged(person, damage),
      unsentEditDamaged(person),
      appDataCleared(person),
      signedOutElsewhere(person),
      clockIsWrong(person),
      appBackgrounded(person),
      signInExpires(person),
      secondWindow(person),
      refreshHiccup(person, hiccup),
      connectionFlaky(person),
      liveUpdatesDegrade(person),
      liveUpdatesGarbled,
      liveUpdateLost,
      liveUpdatesPause,
      outage,
      teamTidiesUp,
      teamEdit(title, body),
      teamAddsNote(title, body),
    }
  }

  // ------------------------------------------------ invariants

  def _at(i: int): Received = _taken.get(i)

  /** Nothing counts twice: no edit is taken in twice. */
  val invNoDoubleApply: bool =
    _taken.keys().forall(i => _taken.keys().forall(j =>
      i < j implies _at(i).mid != _at(j).mid))

  /** Each device's edits reach the shared notes in the order they were made. */
  val invInOrderPerPerson: bool =
    _taken.keys().forall(i => _taken.keys().forall(j =>
      (i < j and _at(i).person == _at(j).person) implies _at(i).mid < _at(j).mid))

  /**
   * Nothing is lost: every edit is taken in, still queued, or was dropped
   * because its author was signed out elsewhere.
   */
  val invNoLostWrites: bool = {
    val done = _processed(_taken)
    0.to(_book.nextMid - 1).forall(mid =>
      done.contains(mid) or _book.discarded.contains(mid)
        or PEOPLE.exists(p => _pending.get(p).keys().contains(mid)))
  }

  /** Deletion is kept: a written note is never forgotten by the shared notes. */
  val invTombstonesKept: bool =
    _taken.keys().forall(i => match _at(i).edit {
      | Write(w) => _at(i).refused or _shared.notes.keys().contains(w.title)
      | _ => true
    })

  /**
   * Only a forbidden delete, a join of a shared space that does not exist,
   * or a damaged edit is refused.
   */
  val invOnlyForbiddenRefused: bool =
    _taken.keys().forall(i => _at(i).refused implies
      (_book.damaged.contains(_at(i).mid) or match _at(i).edit {
        | Delete(_) => true
        | DeleteFolder(_) => true
        | JoinSpace(_) => true
        | _ => false
      }))

  /** Everyone agrees: a settled online device shows the shared notes. */
  val invOnlineAgree: bool =
    PEOPLE.forall(p => (online.get(p) and _heardBack(p)) implies
      (_nothingUnsent(p) and notes.get(p) == notes.get(SHARED)
        and folders.get(p) == folders.get(SHARED)))

  /** An owed retry is for an edit the shared notes already have. */
  val invRetryIsDuplicate: bool =
    PEOPLE.forall(p => not(_heardBack(p)) implies
      _pending.get(p).keys().subseteq(_processed(_taken)))

  /** Once everyone is back online, every edit not dropped has been taken in. */
  val invHealConverges: bool = {
    val healed = PEOPLE.fold({ k: _shared, log: _taken }, (st, p) =>
      _drain(st, _book.damaged, p, _pending.get(p)))
    _processed(healed.log).union(_book.discarded) == 0.to(_book.nextMid - 1)
  }
}
