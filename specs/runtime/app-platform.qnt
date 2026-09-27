// The whole app, as the people using it find it.
//
// Alice, Bob and Carol each open the app on their own device and land on the
// Spaces tab, as guests. From the tabs a person can move between Spaces,
// Notifications and Profile, open Settings and come back to the tab they left.
// A guest can sign in with Google and then has an account whose username is
// their own name. Anyone, guest or not, can host a space and later end it.
// People search finds people with an account by username, never the searcher
// themselves, and asks a guest to sign in instead.
//
// Meanwhile the world moves underneath them: a device can be cut off, at the
// person's end or somewhere on the way, until the connection comes back, and
// the app's serving capacity grows and shrinks, never to nothing and at most
// three. Being cut off never throws anyone out of their place in the app;
// what needs a connection (signing in, searching, hosting and ending a space)
// waits until they are back _online, and the app keeps serving people however
// its capacity changes.
module app_platform {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// The tabs a person moves between.
  pure val TABS: Set[str] = Set("spaces", "notifications", "profile")

  pure val MAX_CAPACITY: int = 3

  /// Where a person is in the app. OnTab(tab): on one of the tabs; Settings: on
  /// Settings; Search: on people search with a name typed; InSpace: in the space
  /// they host; Ended: looking at the space they just ended.
  type Place =
    | OnTab(str)
    | Settings
    | Search
    | InSpace
    | Ended

  /// What people search shows for the name typed.
  type Lookup =
    | Denied
    | Nobody
    | Shows(Person)

  /// Who has opened the app.
  var opened: Set[Person]
  /// Each person's place in the app, on their own device.
  var place: Person -> Place
  /// Who is signed in to an account (everyone else who opened the app is a guest).
  var signedIn: Set[Person]
  /// What each person on people search sees.
  var lookup: Person -> Lookup
  /// How much serving capacity the app has, in parts: at least one, at most
  /// MAX_CAPACITY.
  var capacity: int

  // Bookkeeping, not shown to anyone.
  /// The tab a person left for Settings.
  var lastTab: Person -> str
  /// The name each person on people search typed.
  var searchedFor: Person -> Person
  /// Who is hosting a live space.
  var hosting: Set[Person]
  /// Whose device is cut off.
  var offline: Set[Person]

  pure def _looking(
    place: Person -> Place,
    searchedFor: Person -> Person,
    signedIn: Set[Person],
  ): Person -> Lookup =
    place.keys().filter(p => place.get(p) == Search).mapBy(p =>
      if (not(signedIn.contains(p))) Denied
      else if (searchedFor.get(p) == p or not(signedIn.contains(searchedFor.get(p)))) Nobody
      else Shows(searchedFor.get(p))
    )

  action _moveTo(
    newOpened: Set[Person],
    newPlace: Person -> Place,
    newSignedIn: Set[Person],
    newCapacity: int,
    newLastTab: Person -> str,
    newSearchedFor: Person -> Person,
    newHosting: Set[Person],
    newOffline: Set[Person],
  ): bool = all {
    opened' = newOpened,
    place' = newPlace,
    signedIn' = newSignedIn,
    lookup' = _looking(newPlace, newSearchedFor, newSignedIn),
    capacity' = newCapacity,
    lastTab' = newLastTab,
    searchedFor' = newSearchedFor,
    hosting' = newHosting,
    offline' = newOffline,
  }

  /// A person's place in the app changes; nothing else does.
  action _show(person: Person, s: Place): bool =
    _moveTo(opened, place.set(person, s), signedIn, capacity, lastTab, searchedFor, hosting, offline)

  /// Alice has signed in on her device and Bob is using the app as a guest;
  /// the app has one part of serving capacity.
  action init = _moveTo(
    Set("alice", "bob"),
    Map("alice" -> OnTab("spaces"), "bob" -> OnTab("spaces")),
    Set("alice"),
    1,
    Map(),
    Map(),
    Set(),
    Set(),
  )

  pure def _onTab(s: Place): bool = match s {
    | OnTab(_) => true
    | _ => false
  }

  pure def _tabOf(s: Place): str = match s {
    | OnTab(t) => t
    | _ => ""
  }

  def _online(person: Person): bool =
    opened.contains(person) and not(offline.contains(person))

  /// Opening the app lands a guest on the Spaces tab.
  action open(person: Person): bool = all {
    not(opened.contains(person)),
    _moveTo(
      opened.union(Set(person)),
      place.put(person, OnTab("spaces")),
      signedIn, capacity, lastTab, searchedFor, hosting, offline,
    ),
  }

  /// Go to a tab: from any tab, from Settings, search or an ended space.
  action openTab(person: Person, tab: str): bool = all {
    opened.contains(person),
    place.get(person) != InSpace,
    _show(person, OnTab(tab)),
  }

  action openSettings(person: Person): bool = all {
    opened.contains(person),
    _onTab(place.get(person)),
    _moveTo(
      opened, place.set(person, Settings), signedIn, capacity,
      lastTab.put(person, _tabOf(place.get(person))), searchedFor, hosting, offline,
    ),
  }

  /// Back from Settings to the tab the person left.
  action leaveSettings(person: Person): bool = all {
    opened.contains(person),
    place.get(person) == Settings,
    _show(person, OnTab(lastTab.get(person))),
  }

  /// A guest signs in with Google from the tabs, and comes back to them.
  action signIn(person: Person): bool = all {
    _online(person),
    not(signedIn.contains(person)),
    _onTab(place.get(person)),
    // Search results are what the search found when it ran.
    place.keys().forall(p => place.get(p) == Search implies searchedFor.get(p) != person),
    _moveTo(
      opened, place, signedIn.union(Set(person)), capacity, lastTab, searchedFor,
      hosting, offline,
    ),
  }

  /// Search people for someone's username, from the tabs.
  action lookUp(person: Person, other: Person): bool = all {
    _online(person),
    _onTab(place.get(person)) or place.get(person) == Search,
    _moveTo(
      opened, place.set(person, Search), signedIn, capacity, lastTab,
      searchedFor.put(person, other), hosting, offline,
    ),
  }

  /// Host a space: the person is in it.
  action host(person: Person): bool = all {
    _online(person),
    not(hosting.contains(person)),
    place.get(person) != InSpace,
    _moveTo(
      opened, place.set(person, InSpace), signedIn, capacity, lastTab, searchedFor,
      hosting.union(Set(person)), offline,
    ),
  }

  /// The host ends their space and sees that it has ended.
  action end(person: Person): bool = all {
    _online(person),
    place.get(person) == InSpace,
    _moveTo(
      opened, place.set(person, Ended), signedIn, capacity, lastTab, searchedFor,
      hosting.exclude(Set(person)), offline,
    ),
  }

  /// The person's device is cut off at their end.
  action cutOff(person: Person): bool = all {
    _online(person),
    _moveTo(
      opened, place, signedIn, capacity, lastTab, searchedFor, hosting,
      offline.union(Set(person)),
    ),
  }

  /// The person's connection is cut somewhere on the way to everyone else.
  action cutOffOnTheWay(person: Person): bool = all {
    _online(person),
    _moveTo(
      opened, place, signedIn, capacity, lastTab, searchedFor, hosting,
      offline.union(Set(person)),
    ),
  }

  /// Every connection comes back.
  action reconnect: bool = all {
    offline != Set(),
    _moveTo(opened, place, signedIn, capacity, lastTab, searchedFor, hosting, Set()),
  }

  /// The app gains a part of serving capacity. People keep being served.
  action gainCapacity: bool = all {
    capacity < MAX_CAPACITY,
    _moveTo(opened, place, signedIn, capacity + 1, lastTab, searchedFor, hosting, offline),
  }

  /// The app loses its `part`-th part of serving capacity; never the last one.
  /// People keep being served.
  action loseCapacity(part: int): bool = all {
    capacity > 1,
    part < capacity,
    _moveTo(opened, place, signedIn, capacity - 1, lastTab, searchedFor, hosting, offline),
  }

  /// What a person does on their device.
  action _personStep(person: Person, other: Person, tab: str): bool = any {
    open(person),
    openTab(person, tab),
    openSettings(person),
    leaveSettings(person),
    signIn(person),
    lookUp(person, other),
    host(person),
    end(person),
  }

  /// What happens to people's connections and the app's capacity underneath them.
  action _worldStep(person: Person, part: int): bool = any {
    cutOff(person),
    cutOffOnTheWay(person),
    reconnect,
    gainCapacity,
    loseCapacity(part),
  }

  /// People act three times as often as the world moves under them.
  action step = {
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    nondet tab = TABS.oneOf()
    nondet part = 0.to(MAX_CAPACITY - 1).oneOf()
    any {
      _personStep(person, other, tab),
      _personStep(person, other, tab),
      _personStep(person, other, tab),
      _worldStep(person, part),
    }
  }

  /// The app always has some serving capacity, and never more than MAX_CAPACITY.
  val invCapacityInBounds = capacity >= 1 and capacity <= MAX_CAPACITY

  /// Only people who opened the app have a place, an account or a connection.
  val invOnlyOpened = and {
    place.keys() == opened,
    signedIn.subseteq(opened),
    offline.subseteq(opened),
    hosting.subseteq(opened),
  }

  /// Search shows someone only to a signed-in person, and never themselves.
  val invSearchShowsOthers = lookup.keys().forall(p => match lookup.get(p) {
    | Shows(q) => q != p and signedIn.contains(p) and signedIn.contains(q)
    | Denied => not(signedIn.contains(p))
    | Nobody => signedIn.contains(p)
  })

  /// Whoever is in a space is hosting it.
  val invInSpaceHosts = opened.forall(p => place.get(p) == InSpace implies hosting.contains(p))
}
