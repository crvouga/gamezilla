// A shared counter kept by a room, with Alice and Bob in it.
//
// The room keeps the one true count, and Alice and Bob each change it by one,
// up or down. While a person is online their device shows the room's count.
// While they are offline, or their network has stalled, their device shows the
// count it last showed plus the changes they have made since; those changes
// wait on the device and reach the room once the person is back. A person's
// app can crash: while it is down it shows nothing, but it keeps the changes
// still waiting on it and sends them once it restarts. The room can crash and
// restart too: it comes back with the count it had, and anyone who was
// offline reconnects as it comes back.
//
// Every change a device sends carries an id, and the room counts an id once,
// however many times it arrives: when a device resends a change under an id
// it already sent, or when a person's session is taken over by a new one of
// theirs. A change the room does not understand, and something that is not a
// change at all, alter nothing; neither does a session being taken over.
module shared_counter {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob")
  /// Ids a device can send a change under.
  pure val COMMAND_IDS: Set[str] = Set("x1", "x2")

  /// How a person's device reaches the room.
  type Link =
    | Online
    | Offline
    | Paused
    | Crashed

  /// The room's count.
  var room: int
  /// The count each device that is running shows.
  var views: Person -> int
  /// How each device reaches the room.
  var links: Person -> Link

  /// Changes each device has made that the room has not seen yet.
  var waiting: Person -> int
  /// The count each device last showed (kept while it is crashed).
  var shown: Person -> int
  /// Ids of the changes the room has counted.
  var applied: Set[str]
  /// The sum of every change anyone has made.
  var made: int

  pure def running(links: Person -> Link): Set[Person] =
    PEOPLE.filter(p => links.get(p) != Crashed)

  /// Every action changes the state through here, which also sets what each
  /// running device shows.
  action update(
    newRoom: int,
    newLinks: Person -> Link,
    newWaiting: Person -> int,
    newShown: Person -> int,
    newApplied: Set[str],
    newMade: int,
  ): bool = all {
    room' = newRoom,
    links' = newLinks,
    waiting' = newWaiting,
    shown' = newShown,
    applied' = newApplied,
    made' = newMade,
    views' = running(newLinks).mapBy(p => newShown.get(p)),
  }

  /// What each device shows once online devices have caught up with the
  /// room's count.
  pure def caughtUp(links: Person -> Link, shown: Person -> int, count: int): Person -> int =
    PEOPLE.mapBy(p => if (links.get(p) == Online) count else shown.get(p))

  action init = update(
    0,
    PEOPLE.mapBy(_ => Online),
    PEOPLE.mapBy(_ => 0),
    PEOPLE.mapBy(_ => 0),
    Set(),
    0,
  )

  /// A change of `delta` made on `person`'s device.
  action change(person: Person, delta: int): bool = all {
    links.get(person) != Crashed,
    if (links.get(person) == Online)
      update(room + delta, links, waiting, caughtUp(links, shown, room + delta), applied, made + delta)
    else
      update(
        room,
        links,
        waiting.set(person, waiting.get(person) + delta),
        shown.set(person, shown.get(person) + delta),
        applied,
        made + delta,
      ),
  }

  action increment(person: Person): bool = change(person, 1)

  action decrement(person: Person): bool = change(person, -1)

  /// `person` comes back online: what waited on their device reaches the room.
  action backOnline(person: Person): bool = {
    val count = room + waiting.get(person)
    val newLinks = links.set(person, Online)
    update(count, newLinks, waiting.set(person, 0), caughtUp(newLinks, shown, count), applied, made)
  }

  action disconnect(person: Person): bool = all {
    links.get(person) == Online,
    update(room, links.set(person, Offline), waiting, shown, applied, made),
  }

  action connect(person: Person): bool = all {
    links.get(person) == Offline,
    backOnline(person),
  }

  action pauseNetwork(person: Person): bool = all {
    links.get(person) == Online,
    update(room, links.set(person, Paused), waiting, shown, applied, made),
  }

  action resumeNetwork(person: Person): bool = all {
    links.get(person) == Paused,
    backOnline(person),
  }

  action crash(person: Person): bool = all {
    Set(Online, Offline).contains(links.get(person)),
    update(room, links.set(person, Crashed), waiting, shown, applied, made),
  }

  action restart(person: Person): bool = all {
    links.get(person) == Crashed,
    backOnline(person),
  }

  /// The room crashes and restarts: it comes back with the count it had, and
  /// everyone who was offline reconnects, bringing the changes waiting on
  /// their devices.
  action roomRestarts: bool = {
    val count = room + PEOPLE.fold(0, (sum, p) =>
      if (links.get(p) == Offline) sum + waiting.get(p) else sum
    )
    val newLinks = PEOPLE.mapBy(p => if (links.get(p) == Offline) Online else links.get(p))
    val newWaiting = PEOPLE.mapBy(p => if (links.get(p) == Offline) 0 else waiting.get(p))
    update(count, newLinks, newWaiting, caughtUp(newLinks, shown, count), applied, made)
  }

  /// `person`'s device sends an increment under `id`, or resends it; an id
  /// the room has already counted changes nothing.
  action sendCommand(person: Person, id: str): bool = all {
    links.get(person) == Online,
    if (applied.contains(id))
      update(room, links, waiting, shown, applied, made)
    else
      update(room + 1, links, waiting, caughtUp(links, shown, room + 1), applied.union(Set(id)), made + 1),
  }

  /// A new session of `person`'s takes over their earlier one: nothing
  /// changes.
  action takeOver(person: Person): bool = all {
    links.get(person) == Online,
    update(room, links, waiting, shown, applied, made),
  }

  /// `person` makes a change the room does not understand: it is refused on
  /// their device and nothing changes.
  action sendUnknownCommand(person: Person): bool = all {
    links.get(person) != Crashed,
    update(room, links, waiting, shown, applied, made),
  }

  /// `person`'s device sends the room something that is not a change at
  /// all: nothing changes.
  action sendMalformedFrame(person: Person): bool = all {
    links.get(person) == Online,
    update(room, links, waiting, shown, applied, made),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet id = COMMAND_IDS.oneOf()
    any {
      increment(person),
      decrement(person),
      disconnect(person),
      connect(person),
      pauseNetwork(person),
      resumeNetwork(person),
      crash(person),
      restart(person),
      roomRestarts,
      sendCommand(person, id),
      takeOver(person),
      sendUnknownCommand(person),
      sendMalformedFrame(person),
    }
  }

  /// Everyone online agrees with the room.
  val invOnlineAgree = PEOPLE.forall(p =>
    links.get(p) == Online implies shown.get(p) == room
  )

  /// Only a device that cannot reach the room has changes waiting on it.
  val invWaitingOnlyWhenApart = PEOPLE.forall(p =>
    waiting.get(p) != 0 implies links.get(p) != Online
  )

  /// The room's count plus what still waits on devices is every change
  /// anyone made: no change is lost or counted twice.
  val invNothingLost = room + PEOPLE.fold(0, (sum, p) => sum + waiting.get(p)) == made
}
