// Notes kept in step across people's devices.
//
// Alice and Bob each use a device that keeps its own copy of the notes and a
// shared copy everyone syncs through. A person writes or deletes a note on
// their device and sees it there at once, online or not; only a note's owner
// (whoever wrote it last) may delete it. Once a device is online and the
// system has settled, it shows exactly the shared copy. A device that goes
// offline keeps its own writes and sends them, in order, when it is back.
// Writes whose confirmation is lost are retried and still count once; a
// refused write is undone and leaves the author a notice. Crashes, a lossy
// live channel, and edits made straight to the shared copy change none of
// this.
//
// Each step is one action followed by the system settling (uploads drained,
// pushes delivered, online devices refreshed) — what the product reaches
// after a quiet moment. Traces replay against `exampleSystem`
// (`note-replication.binding.ts`).
module note_replication {
  type Person = str
  type NoteId = str

  /** A row. Deletion is data (a tombstone), never absence. */
  type Row = { body: str, deleted: bool, owner: Person }
  type Rows = NoteId -> Row

  type Op =
    | SetNote({ id: NoteId, body: str })
    | DeleteNote(NoteId)

  /**
   * A device's unacknowledged writes, keyed by write id (ids only grow, so
   * id order is the order they were made). Traces carry no lists, so queues
   * and logs are maps walked in key order.
   */
  type Queue = int -> Op

  /** One write the shared copy processed; a refused one changes no rows. */
  type Replay = { person: Person, mid: int, op: Op, rejected: bool }
  /** Processing order → replay. */
  type Log = int -> Replay

  pure val PEOPLE: Set[Person] = Set("alice", "bob")
  pure val SHARED = "shared"

  // ------------------------------------------------ observable state

  /** Live notes (id → body) on the shared copy and on each person's device. */
  var notes: str -> (NoteId -> str)
  /** Unacknowledged refusal notices per person. */
  var rejections: Person -> int

  // ------------------------------------------------ bookkeeping

  var shared: Rows
  var replays: Log
  /** The last copy of the shared notes each device merged. */
  var snapshot: Person -> Rows
  /** Each device's unacknowledged writes, in order. */
  var pending: Person -> Queue
  var online: Person -> bool
  /** The write's confirmation was lost; the device owes a retry. */
  var awaitingRetry: Person -> bool
  var degradedLive: Set[Person]
  var nextMid: int

  // ------------------------------------------------ rules

  pure def isLive(rows: Rows, id: NoteId): bool =
    rows.keys().contains(id) and not(rows.get(id).deleted)

  /** Only a live note's owner may delete it. */
  pure def authorized(rows: Rows, actor: Person, op: Op): bool = match op {
    | SetNote(_) => true
    | DeleteNote(id) => not(isLive(rows, id)) or rows.get(id).owner == actor
  }

  /** Writing takes ownership and revives; deleting leaves a tombstone. */
  pure def applyOp(rows: Rows, actor: Person, op: Op): Rows = match op {
    | SetNote(w) => rows.put(w.id, { body: w.body, deleted: false, owner: actor })
    | DeleteNote(id) =>
      if (isLive(rows, id)) rows.set(id, { ...rows.get(id), deleted: true })
      else rows
  }

  /** The queue's write ids, oldest first. */
  pure def inOrder(queue: Queue): List[int] =
    range(0, queue.keys().fold(0, (hi, mid) => if (mid + 1 > hi) mid + 1 else hi))
      .select(mid => queue.keys().contains(mid))

  /** A device's view: the merged copy with its own queue replayed on top. */
  pure def rebase(rows: Rows, actor: Person, queue: Queue): Rows =
    inOrder(queue).foldl(rows, (acc, mid) =>
      if (authorized(acc, actor, queue.get(mid))) applyOp(acc, actor, queue.get(mid))
      else acc)

  pure def live(rows: Rows): NoteId -> str =
    rows.keys().filter(id => not(rows.get(id).deleted)).mapBy(id => rows.get(id).body)

  pure def processed(log: Log): Set[int] = log.keys().map(i => log.get(i).mid)

  pure def logged(log: Log, r: Replay): Log = log.put(log.keys().size(), r)

  /** The shared copy applies each write at most once, refusing forbidden ones. */
  pure def replay(
    st: { rows: Rows, log: Log },
    person: Person,
    mid: int,
    op: Op
  ): { rows: Rows, log: Log } =
    if (processed(st.log).contains(mid)) st
    else if (authorized(st.rows, person, op)) {
      rows: applyOp(st.rows, person, op),
      log: logged(st.log, { person: person, mid: mid, op: op, rejected: false }),
    }
    else {
      rows: st.rows,
      log: logged(st.log, { person: person, mid: mid, op: op, rejected: true }),
    }

  pure def drain(
    st: { rows: Rows, log: Log },
    person: Person,
    queue: Queue
  ): { rows: Rows, log: Log } =
    inOrder(queue).foldl(st, (acc, mid) => replay(acc, person, mid, queue.get(mid)))

  // ------------------------------------------------ settling

  /**
   * After an action: each device in `uploads` that is online sends its
   * queue; those in `acked` get the confirmation and drop it; every online
   * device then merges the shared copy. Offline devices see nothing.
   */
  action settle(
    rows: Rows,
    log: Log,
    queues: Person -> Queue,
    conn: Person -> bool,
    uploads: Set[Person],
    acked: Set[Person]
  ): bool = {
    val st = uploads.filter(p => conn.get(p)).fold(
      { rows: rows, log: log },
      (acc, p) => drain(acc, p, queues.get(p)))
    val queues2 = PEOPLE.mapBy(p =>
      if (conn.get(p) and acked.contains(p)) Map() else queues.get(p))
    val snap2 = PEOPLE.mapBy(p => if (conn.get(p)) st.rows else snapshot.get(p))
    all {
      shared' = st.rows,
      replays' = st.log,
      online' = conn,
      pending' = queues2,
      snapshot' = snap2,
      notes' = PEOPLE.mapBy(p => live(rebase(snap2.get(p), p, queues2.get(p))))
        .put(SHARED, live(st.rows)),
      rejections' = PEOPLE.mapBy(p =>
        st.log.keys().filter(i => st.log.get(i).person == p and st.log.get(i).rejected).size()),
    }
  }

  def deviceRows(p: Person): Rows = rebase(snapshot.get(p), p, pending.get(p))
  def settled(p: Person): bool = not(awaitingRetry.get(p))
  def noRetryOwed: bool = PEOPLE.forall(p => settled(p))

  // ------------------------------------------------ actions

  action init = all {
    shared' = Map(),
    replays' = Map(),
    snapshot' = PEOPLE.mapBy(_ => Map()),
    pending' = PEOPLE.mapBy(_ => Map()),
    online' = PEOPLE.mapBy(_ => true),
    awaitingRetry' = PEOPLE.mapBy(_ => false),
    degradedLive' = Set(),
    nextMid' = 0,
    notes' = PEOPLE.mapBy(_ => Map()).put(SHARED, Map()),
    rejections' = PEOPLE.mapBy(_ => 0),
  }

  action write(person: Person, op: Op): bool = all {
    settled(person),
    authorized(deviceRows(person), person, op),
    nextMid' = nextMid + 1,
    awaitingRetry' = awaitingRetry,
    degradedLive' = degradedLive,
    settle(
      shared, replays,
      pending.set(person, pending.get(person).put(nextMid, op)),
      online, Set(person), Set(person)
    ),
  }

  /** Write a note, taking ownership (and reviving it if deleted). */
  action setNote(person: Person, id: NoteId, body: str): bool =
    write(person, SetNote({ id: id, body: body }))

  /** Delete a note the person owns; a device refuses anyone else's. */
  action deleteNote(person: Person, id: NoteId): bool =
    write(person, DeleteNote(id))

  /**
   * Write a note online, but its confirmation never arrives: the shared copy
   * has it, the device still queues it (and shows it) until `retryUpload`.
   * At most one retry is owed at a time: independent backoff timers race,
   * and a trace must pin which lands first.
   */
  action setNoteReplyLost(person: Person, id: NoteId, body: str): bool = all {
    online.get(person),
    noRetryOwed,
    pending.get(person).keys().size() == 0,
    nextMid' = nextMid + 1,
    awaitingRetry' = awaitingRetry.set(person, true),
    degradedLive' = degradedLive,
    settle(
      shared, replays,
      pending.set(person, Map(nextMid -> SetNote({ id: id, body: body }))),
      online, Set(person), Set()
    ),
  }

  /** The device re-sends its queue; the shared copy dedupes the write. */
  action retryUpload(person: Person): bool = all {
    not(settled(person)),
    nextMid' = nextMid,
    awaitingRetry' = awaitingRetry.set(person, false),
    degradedLive' = degradedLive,
    settle(shared, replays, pending, online, Set(person), Set(person)),
  }

  action goOffline(person: Person): bool = all {
    online.get(person),
    settled(person),
    nextMid' = nextMid,
    awaitingRetry' = awaitingRetry,
    degradedLive' = degradedLive,
    settle(shared, replays, pending, online.set(person, false), Set(), Set()),
  }

  action goOnline(person: Person): bool = all {
    not(online.get(person)),
    nextMid' = nextMid,
    awaitingRetry' = awaitingRetry,
    degradedLive' = degradedLive,
    settle(shared, replays, pending, online.set(person, true), Set(person), Set(person)),
  }

  /** The app crashes and reopens; its notes and queue survive. */
  action crashAndReopen(person: Person): bool = all {
    online.get(person),
    settled(person),
    nextMid' = nextMid,
    awaitingRetry' = awaitingRetry,
    degradedLive' = degradedLive,
    settle(shared, replays, pending, online, Set(person), Set(person)),
  }

  /** The person's live channel starts dropping, duplicating and reordering. */
  action degradeLive(person: Person): bool = all {
    not(degradedLive.contains(person)),
    nextMid' = nextMid,
    awaitingRetry' = awaitingRetry,
    degradedLive' = degradedLive.union(Set(person)),
    settle(shared, replays, pending, online, Set(), Set()),
  }

  /** An edit made straight to the shared copy, announcing nothing. */
  action operatorEdit(id: NoteId, body: str): bool = all {
    shared.keys().contains(id),
    nextMid' = nextMid,
    awaitingRetry' = awaitingRetry,
    degradedLive' = degradedLive,
    settle(
      shared.set(id, { ...shared.get(id), body: body }),
      replays, pending, online, Set(), Set()
    ),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet id = Set("n1", "n2").oneOf()
    nondet body = Set("x", "y").oneOf()
    any {
      setNote(person, id, body),
      deleteNote(person, id),
      setNoteReplyLost(person, id, body),
      retryUpload(person),
      goOffline(person),
      goOnline(person),
      crashAndReopen(person),
      degradeLive(person),
      operatorEdit(id, body),
    }
  }

  // ------------------------------------------------ invariants

  def replayAt(i: int): Replay = replays.get(i)

  /** Nothing counts twice: no write is applied twice. */
  val invNoDoubleApply: bool =
    replays.keys().forall(i => replays.keys().forall(j =>
      i < j implies replayAt(i).mid != replayAt(j).mid))

  /** Each device's writes reach the shared copy in the order they were made. */
  val invInOrderPerPerson: bool =
    replays.keys().forall(i => replays.keys().forall(j =>
      (i < j and replayAt(i).person == replayAt(j).person)
        implies replayAt(i).mid < replayAt(j).mid))

  /** Nothing is lost: every write is processed or still queued. */
  val invNoLostWrites: bool = {
    val done = processed(replays)
    0.to(nextMid - 1).forall(mid =>
      done.contains(mid) or PEOPLE.exists(p => pending.get(p).keys().contains(mid)))
  }

  /** Deletion is data: a written note is never erased from the shared copy. */
  val invTombstonesKept: bool =
    replays.keys().forall(i => match replayAt(i).op {
      | SetNote(w) => replayAt(i).rejected or shared.keys().contains(w.id)
      | DeleteNote(_) => true
    })

  /** Only a forbidden delete is refused. */
  val invOnlyForbiddenRefused: bool =
    replays.keys().forall(i => replayAt(i).rejected implies match replayAt(i).op {
      | SetNote(_) => false
      | DeleteNote(_) => true
    })

  /** Everyone agrees: a settled online device shows the shared copy. */
  val invOnlineAgree: bool =
    PEOPLE.forall(p => (online.get(p) and settled(p)) implies
      (pending.get(p).keys().size() == 0 and notes.get(p) == notes.get(SHARED)))

  /** An owed retry is for a write the shared copy already has. */
  val invRetryIsDuplicate: bool =
    PEOPLE.forall(p => not(settled(p)) implies
      pending.get(p).keys().subseteq(processed(replays)))

  /** Once everyone is back online, every write has been processed. */
  val invHealConverges: bool = {
    val healed = PEOPLE.fold({ rows: shared, log: replays }, (st, p) =>
      drain(st, p, pending.get(p)))
    processed(healed.log) == 0.to(nextMid - 1)
  }
}
