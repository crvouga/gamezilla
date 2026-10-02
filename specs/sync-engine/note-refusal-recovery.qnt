// Two people each write one checked note, online or offline. Their writing
// may be kept or refused. Lost word about either answer must not change
// later writing, leave refused writing behind, or keep its author waiting
// once connections stay back and answers can reach them.
module note_refusal_recovery {
  type Person = str
  type Note = { body: str, owner: Person }
  pure val PEOPLE = Set("alice", "bob")
  pure val EMPTY = { body: "", owner: "" }

  /// What each app and the shared notes show.
  var notes: str -> Note
  /// Each app's answer about its person's writing.
  var answers: Person -> str
  /// Refusal notices visible to each writer.
  var rejections: Person -> int
  /// Whether each app is told its device has a connection.
  var online: Person -> bool

  var _shared: Note
  var _snapshot: Person -> Note
  var _body: Person -> str
  var _processed: Set[Person]
  var _previous: Note
  var _unchanged: bool

  action _settle(person: Person, body: str, answer: str, connected: Person -> bool): bool = {
    val waiting = answer == "saving"
    val delivered = waiting and connected.get(person)
    val first = delivered and not(_processed.contains(person))
    val shared = if (first and body != "refused") { body: body, owner: person } else _shared
    val processed = if (delivered) _processed.union(Set(person)) else _processed
    val replies = answers.set(person, answer)
    val bodies = _body.set(person, body)
    val snapshots = PEOPLE.mapBy(p => if (connected.get(p)) shared else _snapshot.get(p))
    val views = PEOPLE.mapBy(p => if (replies.get(p) == "saving")
      { body: bodies.get(p), owner: p } else snapshots.get(p))
    all {
      notes' = views.put("shared", shared),
      answers' = replies,
      rejections' = PEOPLE.mapBy(p => if (replies.get(p) == "refused") 1 else 0),
      online' = connected,
      _shared' = shared, _snapshot' = snapshots, _body' = bodies,
      _processed' = processed, _previous' = _shared,
      _unchanged' = (delivered and (body == "refused" or _processed.contains(person))),
    }
  }

  action init = all {
    notes' = PEOPLE.mapBy(_ => EMPTY).put("shared", EMPTY),
    answers' = PEOPLE.mapBy(_ => "ready"),
    rejections' = PEOPLE.mapBy(_ => 0),
    online' = PEOPLE.mapBy(_ => true),
    _shared' = EMPTY, _snapshot' = PEOPLE.mapBy(_ => EMPTY),
    _body' = PEOPLE.mapBy(_ => ""), _processed' = Set(),
    _previous' = EMPTY, _unchanged' = false,
  }

  /// Write once; word about a kept or refused save may be lost.
  action writeUnheard(person: Person, body: str): bool = all {
    answers.get(person) == "ready",
    _settle(person, body, "saving", online),
  }

  /// Hearing back shows the answer and the shared note, including on refusal.
  action hearBack(person: Person): bool = all {
    online.get(person), answers.get(person) == "saving", _processed.contains(person),
    _settle(person, _body.get(person), if (_body.get(person) == "refused") "refused" else "saved", online),
  }

  /// Losing the connection preserves an unanswered piece of writing.
  action goOffline(person: Person): bool = all {
    online.get(person),
    _settle(person, _body.get(person), answers.get(person), online.set(person, false)),
  }

  /// Returning sends writing or asks again about its earlier answer.
  action goOnline(person: Person): bool = all {
    not(online.get(person)),
    _settle(person, _body.get(person), answers.get(person), online.set(person, true)),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet body = Set("milk", "eggs", "refused").oneOf()
    any { writeUnheard(person, body), hearBack(person), goOffline(person), goOnline(person) }
  }

  /// Refused writing is never kept in the shared notes.
  val invRefusedWritingNeverKept = notes.get("shared").body != "refused"

  /// Asking again or refusing writing preserves every later accepted change.
  val invRetryAndRefusalPreserveWriting = _unchanged implies _shared == _previous

  /// A waiting writer can still see the writing they are waiting about.
  val invWaitingPreservesIntent = PEOPLE.forall(p => answers.get(p) == "saving"
    implies notes.get(p) == { body: _body.get(p), owner: p })

  /// Once answered and connected, the app shows the shared note.
  val invAnsweredDevicesAgree = PEOPLE.forall(p => online.get(p) and answers.get(p) != "saving"
    implies notes.get(p) == notes.get("shared"))

  /// Refusal gives exactly one notice, including after repeated lost answers.
  val invOneRefusalNotice = PEOPLE.forall(p => rejections.get(p) ==
    (if (answers.get(p) == "refused") 1 else 0))

  /// Saved and refused are answers only to writing everyone has considered.
  val invEveryAnswerWasConsidered = PEOPLE.forall(p => Set("saved", "refused").contains(answers.get(p))
    implies _processed.contains(p))

  val _state = (notes, answers, rejections, online, _shared, _snapshot, _body, _processed, _previous, _unchanged)
  temporal _wordArrives = hearBack("alice").weakFair(_state) and hearBack("bob").weakFair(_state)
  temporal _connectionsStay = eventually(always(PEOPLE.forall(p => online.get(p))))

  /// Even refused writing eventually stops saying it is saving.
  temporal liveEveryWriterGetsAnAnswer = (_connectionsStay and _wordArrives).implies(
    PEOPLE.forall(p => (answers.get(p) == "saving").leadsTo(Set("saved", "refused").contains(answers.get(p)))))

  /// With connections back and answers delivered, everyone keeps agreeing.
  temporal liveDevicesKeepAgreeing = (_connectionsStay and _wordArrives).implies(
    eventually(always(notes.keys().forall(key => notes.get(key) == _shared))))
}
