// Bob's inbox holds one friend request. Opening it, or marking the inbox
// read, marks that request opened when his device has a connection. Archiving
// moves it to the archived inbox. With no connection those choices change
// nothing and he is told the connection is missing. Choosing which inbox
// list to look at never changes the items. A day passing never removes one.
module inbox_items {
  pure val BOB = "bob"
  pure val BOB_PHONE = "bob-phone"
  pure val DEVICES = Set(BOB, BOB_PHONE)
  pure val REQUEST = "request"
  pure val LISTS = Set("ordinary", "waiting", "archived")

  /// Friend requests Bob has not opened.
  var unopened: Set[str]
  /// Friend requests Bob has opened and has not archived.
  var opened: Set[str]
  /// Friend requests Bob has archived.
  var archived: Set[str]
  /// "ordinary", "waiting" or "archived": the inbox list he is looking at.
  var list: str
  /// "" or "missing": whether he is told the connection is missing.
  var told: str
  /// Devices whose connection is gone.
  var _offline: Set[str]
  /// Every inbox item that exists. The clock does not shrink this.
  var _items: Set[str]

  pure def _whole(waiting: Set[str], seen: Set[str], aside: Set[str]): Set[str] =
    waiting.union(seen).union(aside)

  action _keep(
    waiting: Set[str],
    seen: Set[str],
    aside: Set[str],
    shown: str,
    message: str,
    offline: Set[str],
  ): bool = all {
    unopened' = waiting,
    opened' = seen,
    archived' = aside,
    list' = shown,
    told' = message,
    _offline' = offline,
    _items' = _items,
  }

  action init = all {
    unopened' = Set(REQUEST),
    opened' = Set(),
    archived' = Set(),
    list' = "ordinary",
    told' = "",
    _offline' = Set(),
    _items' = Set(REQUEST),
  }

  /// Open the waiting friend request. With a connection it is marked opened.
  /// With no connection it stays waiting and he is told the connection is missing.
  action openItem(device: str): bool = all {
    DEVICES.contains(device),
    list != "archived",
    unopened != Set(),
    if (_offline.contains(device))
      _keep(unopened, opened, archived, list, "missing", _offline)
    else
      _keep(Set(), opened.union(unopened), archived, list, "", _offline),
  }

  /// Mark every waiting inbox item opened. With no connection, nothing changes.
  action markAllRead(device: str): bool = all {
    DEVICES.contains(device),
    list != "archived",
    unopened != Set(),
    if (_offline.contains(device))
      _keep(unopened, opened, archived, list, "missing", _offline)
    else
      _keep(Set(), opened.union(unopened), archived, list, "", _offline),
  }

  /// Archive every ordinary inbox item. With no connection, nothing moves.
  action archiveItem(device: str): bool = all {
    DEVICES.contains(device),
    list != "archived",
    unopened.union(opened) != Set(),
    if (_offline.contains(device))
      _keep(unopened, opened, archived, list, "missing", _offline)
    else
      _keep(Set(), Set(), archived.union(unopened).union(opened), list, "", _offline),
  }

  /// Look at one inbox list. The items stay where they are, online or not.
  action chooseList(which: str): bool = all {
    LISTS.contains(which),
    _keep(unopened, opened, archived, which, told, _offline),
  }

  /// A day passes. Every inbox item stays where it was.
  action dayPasses: bool = all {
    _items != Set(),
    _keep(unopened, opened, archived, list, told, _offline),
  }

  /// This device loses its connection. Refused when that connection is already gone.
  action loseConnection(device: str): bool = all {
    DEVICES.contains(device),
    not(_offline.contains(device)),
    _keep(unopened, opened, archived, list, told, _offline.union(Set(device))),
  }

  /// This device's connection comes back. Refused when it never left.
  action connectionReturns(device: str): bool = all {
    DEVICES.contains(device),
    _offline.contains(device),
    _keep(unopened, opened, archived, list, "", _offline.exclude(Set(device))),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet which = LISTS.oneOf()
    any {
      openItem(device),
      markAllRead(device),
      archiveItem(device),
      chooseList(which),
      dayPasses,
      loseConnection(device),
      connectionReturns(device),
    }
  }

  /// Opening, archiving and the clock only move items between these sets.
  val invItemsRemain = all {
    unopened.intersect(opened) == Set(),
    unopened.intersect(archived) == Set(),
    opened.intersect(archived) == Set(),
    _whole(unopened, opened, archived) == _items,
  }

  /// Being told the connection is missing happens only while a device is offline.
  val invMissingMeansOffline =
    (told == "missing") implies not(_offline == Set())

  /// The inbox list is one of the three a person can look at.
  val invListIsKnown = LISTS.contains(list)
}
