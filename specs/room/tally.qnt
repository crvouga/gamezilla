// The shared tally of a game room, with Alice and Bob in it.
//
// Alice and Bob each add one to the tally or take one off it. While a
// person is online, their app shows the tally everyone has. While they are
// offline, it shows the tally they last saw plus the changes they have made
// since; those changes wait on their phone and reach everyone once they are
// back online. A person's app can close unexpectedly: until they reopen it,
// it shows nothing, but it keeps the changes still waiting in it, and they
// reach everyone once it is open again. No change anyone makes is ever lost
// or counted twice.
module tally {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob")
  /// Changes a phone can send the room, and send again.
  pure val CHANGES: Set[str] = Set("x1", "x2")

  /// Where a person's phone stands: online, offline, or with its app closed.
  type PhoneState =
    | Online
    | Offline
    | AppClosed

  /// The tally everyone has.
  var tally: int
  /// The tally each open app shows.
  var shownTally: Person -> int
  /// Where each person's phone stands.
  var phoneState: Person -> PhoneState

  /// Changes each phone has made that have not reached everyone yet.
  var _waiting: Person -> int
  /// The tally each phone last showed (kept while its app is closed).
  var _lastShown: Person -> int
  /// The changes the room has counted.
  var _counted: Set[str]
  /// The sum of every change anyone has made.
  var _made: int
  /// Phones whose connection has silently stopped carrying anything, in
  /// either direction, while the phone still believes it is online.
  var _stalled: Set[Person]

  pure def _running(phoneState: Person -> PhoneState): Set[Person] =
    PEOPLE.filter(p => phoneState.get(p) != AppClosed)

  /// A phone that reaches the room: online, and not stalled.
  pure def _reaches(phoneState: Person -> PhoneState, stalled: Set[Person], p: Person): bool =
    phoneState.get(p) == Online and not(stalled.contains(p))

  /// Every action changes the state through here, which also sets what each
  /// open app shows.
  action _update(
    newTally: int,
    newPhoneState: Person -> PhoneState,
    newWaiting: Person -> int,
    newLastShown: Person -> int,
    newCounted: Set[str],
    newMade: int,
    newStalled: Set[Person],
  ): bool = all {
    tally' = newTally,
    phoneState' = newPhoneState,
    _waiting' = newWaiting,
    _lastShown' = newLastShown,
    _counted' = newCounted,
    _made' = newMade,
    _stalled' = newStalled,
    shownTally' = _running(newPhoneState).mapBy(p => newLastShown.get(p)),
  }

  action _unchanged: bool =
    _update(tally, phoneState, _waiting, _lastShown, _counted, _made, _stalled)

  /// What each phone shows once the phones that reach the room have caught
  /// up with `count`.
  pure def _caughtUp(
    phoneState: Person -> PhoneState,
    stalled: Set[Person],
    lastShown: Person -> int,
    count: int,
  ): Person -> int =
    PEOPLE.mapBy(p => if (_reaches(phoneState, stalled, p)) count else lastShown.get(p))

  action init = _update(
    0,
    PEOPLE.mapBy(_ => Online),
    PEOPLE.mapBy(_ => 0),
    PEOPLE.mapBy(_ => 0),
    Set(),
    0,
    Set(),
  )

  /// A change of `delta` made in `person`'s app.
  action _change(person: Person, delta: int): bool = all {
    phoneState.get(person) != AppClosed,
    if (_reaches(phoneState, _stalled, person))
      _update(
        tally + delta,
        phoneState,
        _waiting,
        _caughtUp(phoneState, _stalled, _lastShown, tally + delta),
        _counted,
        _made + delta,
        _stalled,
      )
    else
      _update(
        tally,
        phoneState,
        _waiting.set(person, _waiting.get(person) + delta),
        _lastShown.set(person, _lastShown.get(person) + delta),
        _counted,
        _made + delta,
        _stalled,
      ),
  }

  action addOne(person: Person): bool = _change(person, 1)

  action takeOne(person: Person): bool = _change(person, -1)

  /// `person`'s phone reaches the room again: what waited on it reaches
  /// everyone.
  action _comesBack(person: Person): bool = {
    val count = tally + _waiting.get(person)
    val newPhoneState = phoneState.set(person, Online)
    val newStalled = _stalled.exclude(Set(person))
    _update(
      count,
      newPhoneState,
      _waiting.set(person, 0),
      _caughtUp(newPhoneState, newStalled, _lastShown, count),
      _counted,
      _made,
      newStalled,
    )
  }

  action goOffline(person: Person): bool = all {
    _reaches(phoneState, _stalled, person),
    _update(tally, phoneState.set(person, Offline), _waiting, _lastShown, _counted, _made, _stalled),
  }

  action comeBackOnline(person: Person): bool = all {
    phoneState.get(person) == Offline,
    _comesBack(person),
  }

  /// Nobody sees anything happen when an app closes unexpectedly; what
  /// matters is what it shows once reopened (`reopenApp`).
  action closeUnexpectedly(person: Person): bool = all {
    phoneState.get(person) != AppClosed,
    not(_stalled.contains(person)),
    _update(tally, phoneState.set(person, AppClosed), _waiting, _lastShown, _counted, _made, _stalled),
  }

  action reopenApp(person: Person): bool = all {
    phoneState.get(person) == AppClosed,
    _comesBack(person),
  }

  /// Fault: `person`'s connection silently stops carrying anything while
  /// their phone still believes it is online.
  action _networkStalls(person: Person): bool = all {
    _reaches(phoneState, _stalled, person),
    _update(tally, phoneState, _waiting, _lastShown, _counted, _made, _stalled.union(Set(person))),
  }

  /// Fault: a stalled connection carries again.
  action _networkRecovers(person: Person): bool = all {
    _stalled.contains(person),
    _comesBack(person),
  }

  /// Fault: the room stops and starts again. It comes back with the tally it
  /// had, and every offline phone reconnects as it does, bringing its
  /// waiting changes.
  action _roomRestarts: bool = {
    val count = tally + PEOPLE.fold(0, (sum, p) =>
      if (phoneState.get(p) == Offline) sum + _waiting.get(p) else sum
    )
    val newPhoneState =
      PEOPLE.mapBy(p => if (phoneState.get(p) == Offline) Online else phoneState.get(p))
    val newWaiting =
      PEOPLE.mapBy(p => if (phoneState.get(p) == Offline) 0 else _waiting.get(p))
    _update(
      count,
      newPhoneState,
      newWaiting,
      _caughtUp(newPhoneState, _stalled, _lastShown, count),
      _counted,
      _made,
      _stalled,
    )
  }

  /// Fault: `person`'s phone sends the add-one `change`, or sends it again
  /// not knowing whether it arrived; a change already counted changes
  /// nothing.
  action _resend(person: Person, change: str): bool = all {
    _reaches(phoneState, _stalled, person),
    if (_counted.contains(change)) _unchanged
    else
      _update(
        tally + 1,
        phoneState,
        _waiting,
        _caughtUp(phoneState, _stalled, _lastShown, tally + 1),
        _counted.union(Set(change)),
        _made + 1,
        _stalled,
      ),
  }

  /// Fault: `person` comes into the room again as a newer arrival, taking
  /// over from their earlier one: nothing changes.
  action _takeOver(person: Person): bool = all {
    _reaches(phoneState, _stalled, person),
    _unchanged,
  }

  /// Fault: `person`'s app sends a command the room does not understand: it
  /// is refused as invalid in their app and nothing changes.
  action _makeInvalidChange(person: Person): bool = all {
    phoneState.get(person) != AppClosed,
    _unchanged,
  }

  /// Fault: `person`'s phone sends the room something garbled that is not a
  /// command at all: nothing changes.
  action _sendGarbledChange(person: Person): bool = all {
    _reaches(phoneState, _stalled, person),
    _unchanged,
  }

  /// Fault: `person` adds one, and their app closes the instant the room
  /// confirms it. The room counts it once; the app shows nothing until it is
  /// reopened.
  action _appClosesAsChangeLands(person: Person): bool = {
    val newPhoneState = phoneState.set(person, AppClosed)
    all {
      _reaches(phoneState, _stalled, person),
      _update(
        tally + 1,
        newPhoneState,
        _waiting,
        _caughtUp(newPhoneState, _stalled, _lastShown, tally + 1),
        _counted,
        _made + 1,
        _stalled,
      ),
    }
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet change = CHANGES.oneOf()
    any {
      addOne(person),
      takeOne(person),
      goOffline(person),
      comeBackOnline(person),
      closeUnexpectedly(person),
      reopenApp(person),
      _networkStalls(person),
      _networkRecovers(person),
      _roomRestarts,
      _resend(person, change),
      _takeOver(person),
      _makeInvalidChange(person),
      _sendGarbledChange(person),
      _appClosesAsChangeLands(person),
    }
  }

  /// Everyone whose phone reaches the room sees the tally everyone has.
  val invReachingPhonesAgree = PEOPLE.forall(p =>
    _reaches(phoneState, _stalled, p) implies _lastShown.get(p) == tally
  )

  /// Only a phone that cannot reach the room has changes waiting on it.
  val invWaitingOnlyWhenApart = PEOPLE.forall(p =>
    _waiting.get(p) != 0 implies not(_reaches(phoneState, _stalled, p))
  )

  /// The tally plus what still waits on phones is every change anyone made:
  /// no change is lost or counted twice.
  val invNothingLost =
    tally + PEOPLE.fold(0, (sum, p) => sum + _waiting.get(p)) == _made
}
