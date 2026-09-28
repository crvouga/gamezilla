// A shared counter kept by a room, with Alice and Bob in it.
//
// The room keeps the one true count, and Alice and Bob each change it by one,
// up or down. While a person is online their device shows the room's count.
// While they are offline, or their network has stalled, their device shows the
// count it last showed plus the changes they have made since; those waiting
// changes stay on the device and reach the room once the person is back. A
// person's app can crash: while it is down it shows nothing, but it keeps the
// changes still waiting on it and sends them once it restarts. The room can
// crash and restart too: it comes back with the count it had, and anyone who
// was offline reconnects as it comes back.
//
// The room counts each change once, however many times it arrives: when a
// device resends a change it already sent, or when a person comes into the
// room again as a newer arrival. A change the room does not understand, and
// something garbled that is not a change at all, alter nothing; neither does
// a newer arrival.
module shared_counter {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob")
  /// Changes a device can send the room, and send again.
  pure val CHANGES: Set[str] = Set("x1", "x2")

  /// Where a person's device stands with the room.
  type DeviceState =
    | Online
    | Offline
    | Stalled
    | Crashed

  /// The room's count.
  var roomCount: int
  /// The count each device that is running shows.
  var shownCount: Person -> int
  /// Where each device stands with the room.
  var deviceState: Person -> DeviceState

  /// Changes each device has made that the room has not seen yet.
  var waitingChanges: Person -> int
  /// The count each device last showed (kept while its app is crashed).
  var _lastShown: Person -> int
  /// The changes the room has counted.
  var _counted: Set[str]
  /// The sum of every change anyone has made.
  var _made: int

  pure def _running(deviceState: Person -> DeviceState): Set[Person] =
    PEOPLE.filter(p => deviceState.get(p) != Crashed)

  /// Every action changes the state through here, which also sets what each
  /// running device shows.
  action _update(
    newRoomCount: int,
    newDeviceState: Person -> DeviceState,
    newWaitingChanges: Person -> int,
    newLastShown: Person -> int,
    newCounted: Set[str],
    newMade: int,
  ): bool = all {
    roomCount' = newRoomCount,
    deviceState' = newDeviceState,
    waitingChanges' = newWaitingChanges,
    _lastShown' = newLastShown,
    _counted' = newCounted,
    _made' = newMade,
    shownCount' = _running(newDeviceState).mapBy(p => newLastShown.get(p)),
  }

  /// What each device shows once online devices have caught up with the
  /// room's count.
  pure def _caughtUp(
    deviceState: Person -> DeviceState,
    lastShown: Person -> int,
    count: int,
  ): Person -> int =
    PEOPLE.mapBy(p => if (deviceState.get(p) == Online) count else lastShown.get(p))

  action init = _update(
    0,
    PEOPLE.mapBy(_ => Online),
    PEOPLE.mapBy(_ => 0),
    PEOPLE.mapBy(_ => 0),
    Set(),
    0,
  )

  /// A change of `delta` made on `person`'s device.
  action _change(person: Person, delta: int): bool = all {
    deviceState.get(person) != Crashed,
    if (deviceState.get(person) == Online)
      _update(
        roomCount + delta,
        deviceState,
        waitingChanges,
        _caughtUp(deviceState, _lastShown, roomCount + delta),
        _counted,
        _made + delta,
      )
    else
      _update(
        roomCount,
        deviceState,
        waitingChanges.set(person, waitingChanges.get(person) + delta),
        _lastShown.set(person, _lastShown.get(person) + delta),
        _counted,
        _made + delta,
      ),
  }

  action increment(person: Person): bool = _change(person, 1)

  action decrement(person: Person): bool = _change(person, -1)

  /// `person` comes back online: what waited on their device reaches the room.
  action _comesBack(person: Person): bool = {
    val count = roomCount + waitingChanges.get(person)
    val newDeviceState = deviceState.set(person, Online)
    _update(
      count,
      newDeviceState,
      waitingChanges.set(person, 0),
      _caughtUp(newDeviceState, _lastShown, count),
      _counted,
      _made,
    )
  }

  action goOffline(person: Person): bool = all {
    deviceState.get(person) == Online,
    _update(roomCount, deviceState.set(person, Offline), waitingChanges, _lastShown, _counted, _made),
  }

  action reconnect(person: Person): bool = all {
    deviceState.get(person) == Offline,
    _comesBack(person),
  }

  action networkStalls(person: Person): bool = all {
    deviceState.get(person) == Online,
    _update(roomCount, deviceState.set(person, Stalled), waitingChanges, _lastShown, _counted, _made),
  }

  action networkRecovers(person: Person): bool = all {
    deviceState.get(person) == Stalled,
    _comesBack(person),
  }

  action appCrashes(person: Person): bool = all {
    Set(Online, Offline).contains(deviceState.get(person)),
    _update(roomCount, deviceState.set(person, Crashed), waitingChanges, _lastShown, _counted, _made),
  }

  action appRestarts(person: Person): bool = all {
    deviceState.get(person) == Crashed,
    _comesBack(person),
  }

  /// The room crashes and restarts: it comes back with the count it had, and
  /// everyone who was offline reconnects, bringing the changes waiting on
  /// their devices.
  action roomRestarts: bool = {
    val count = roomCount + PEOPLE.fold(0, (sum, p) =>
      if (deviceState.get(p) == Offline) sum + waitingChanges.get(p) else sum
    )
    val newDeviceState =
      PEOPLE.mapBy(p => if (deviceState.get(p) == Offline) Online else deviceState.get(p))
    val newWaitingChanges =
      PEOPLE.mapBy(p => if (deviceState.get(p) == Offline) 0 else waitingChanges.get(p))
    _update(
      count,
      newDeviceState,
      newWaitingChanges,
      _caughtUp(newDeviceState, _lastShown, count),
      _counted,
      _made,
    )
  }

  /// `person`'s device sends the increment `change`, or resends it; a change
  /// the room has already counted changes nothing.
  action resend(person: Person, change: str): bool = all {
    deviceState.get(person) == Online,
    if (_counted.contains(change))
      _update(roomCount, deviceState, waitingChanges, _lastShown, _counted, _made)
    else
      _update(
        roomCount + 1,
        deviceState,
        waitingChanges,
        _caughtUp(deviceState, _lastShown, roomCount + 1),
        _counted.union(Set(change)),
        _made + 1,
      ),
  }

  /// `person` comes into the room again as a newer arrival, taking over from
  /// their earlier one: nothing changes.
  action takeOver(person: Person): bool = all {
    deviceState.get(person) == Online,
    _update(roomCount, deviceState, waitingChanges, _lastShown, _counted, _made),
  }

  /// `person` makes a change the room does not understand: it is refused as
  /// invalid on their device and nothing changes.
  action makeInvalidChange(person: Person): bool = all {
    deviceState.get(person) != Crashed,
    _update(roomCount, deviceState, waitingChanges, _lastShown, _counted, _made),
  }

  /// `person`'s device sends the room something garbled that is not a change
  /// at all: nothing changes.
  action sendGarbledChange(person: Person): bool = all {
    deviceState.get(person) == Online,
    _update(roomCount, deviceState, waitingChanges, _lastShown, _counted, _made),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet change = CHANGES.oneOf()
    any {
      increment(person),
      decrement(person),
      goOffline(person),
      reconnect(person),
      networkStalls(person),
      networkRecovers(person),
      appCrashes(person),
      appRestarts(person),
      roomRestarts,
      resend(person, change),
      takeOver(person),
      makeInvalidChange(person),
      sendGarbledChange(person),
    }
  }

  /// Everyone online agrees with the room.
  val invOnlineAgree = PEOPLE.forall(p =>
    deviceState.get(p) == Online implies _lastShown.get(p) == roomCount
  )

  /// Only a device that cannot reach the room has changes waiting on it.
  val invWaitingOnlyWhenApart = PEOPLE.forall(p =>
    waitingChanges.get(p) != 0 implies deviceState.get(p) != Online
  )

  /// The room's count plus what still waits on devices is every change
  /// anyone made: no change is lost or counted twice.
  val invNothingLost =
    roomCount + PEOPLE.fold(0, (sum, p) => sum + waitingChanges.get(p)) == _made
}
