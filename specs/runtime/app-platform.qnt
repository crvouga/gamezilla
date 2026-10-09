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
// Meanwhile a device can be cut off until the connection comes back. Being cut
// off never throws anyone out of their place in the app; what needs a
// connection (signing in and searching) waits until they are back online.
// Hosting and ending one's own space remain available while offline.
module app_platform {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// The tabs a person moves between.
  pure val TABS: Set[str] = Set("spaces", "notifications", "profile")

  /// Checking machinery: the most machines the team runs the app on here.
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
  /// Checking machinery: how many machines the team runs the app on, at least
  /// one and at most MAX_CAPACITY. Nobody using the app can tell.
  var _capacity: int

  // Bookkeeping, not shown to anyone.
  /// The tab a person left for Settings.
  var _lastTab: Person -> str
  /// The name each person on people search typed.
  var _searchedFor: Person -> Person
  /// Who is hosting a live space.
  var hosting: Set[Person]
  /// Whose device is cut off.
  var offline: Set[Person]

  pure def _looking(
    place: Person -> Place,
    _searchedFor: Person -> Person,
    signedIn: Set[Person],
  ): Person -> Lookup =
    place.keys().filter(p => place.get(p) == Search).mapBy(p =>
      if (not(signedIn.contains(p))) Denied
      else if (_searchedFor.get(p) == p or not(signedIn.contains(_searchedFor.get(p)))) Nobody
      else Shows(_searchedFor.get(p))
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
    _capacity' = newCapacity,
    _lastTab' = newLastTab,
    _searchedFor' = newSearchedFor,
    hosting' = newHosting,
    offline' = newOffline,
  }

  /// A person's place in the app changes; nothing else does.
  action _show(person: Person, s: Place): bool =
    _moveTo(opened, place.set(person, s), signedIn, _capacity, _lastTab, _searchedFor, hosting, offline)

  /// Alice has signed in on her device and Bob is using the app as a guest;
  /// the team runs the app on one machine.
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
      signedIn, _capacity, _lastTab, _searchedFor, hosting, offline,
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
      opened, place.set(person, Settings), signedIn, _capacity,
      _lastTab.put(person, _tabOf(place.get(person))), _searchedFor, hosting, offline,
    ),
  }

  /// Back from Settings to the tab the person left.
  action leaveSettings(person: Person): bool = all {
    opened.contains(person),
    place.get(person) == Settings,
    _show(person, OnTab(_lastTab.get(person))),
  }

  /// A guest signs in with Google from the tabs, and comes back to them.
  action signIn(person: Person): bool = all {
    _online(person),
    not(signedIn.contains(person)),
    _onTab(place.get(person)),
    // Search results are what the search found when it ran.
    place.keys().forall(p => place.get(p) == Search implies _searchedFor.get(p) != person),
    _moveTo(
      opened, place, signedIn.union(Set(person)), _capacity, _lastTab, _searchedFor,
      hosting, offline,
    ),
  }

  /// Search people for someone's username, from the tabs.
  action lookUp(person: Person, other: Person): bool = all {
    _online(person),
    _onTab(place.get(person)) or place.get(person) == Search,
    _moveTo(
      opened, place.set(person, Search), signedIn, _capacity, _lastTab,
      _searchedFor.put(person, other), hosting, offline,
    ),
  }

  /// Host a space: the person is in it.
  action host(person: Person): bool = all {
    opened.contains(person),
    not(hosting.contains(person)),
    place.get(person) != InSpace,
    _moveTo(
      opened, place.set(person, InSpace), signedIn, _capacity, _lastTab, _searchedFor,
      hosting.union(Set(person)), offline,
    ),
  }

  /// The host ends their space and sees that it has ended.
  action end(person: Person): bool = all {
    opened.contains(person),
    place.get(person) == InSpace,
    _moveTo(
      opened, place.set(person, Ended), signedIn, _capacity, _lastTab, _searchedFor,
      hosting.exclude(Set(person)), offline,
    ),
  }

  /// The person's device is cut off at their end.
  action cutOff(person: Person): bool = all {
    _online(person),
    _moveTo(
      opened, place, signedIn, _capacity, _lastTab, _searchedFor, hosting,
      offline.union(Set(person)),
    ),
  }

  /// Checking machinery: the person's connection is cut somewhere between
  /// their device and the machines the app runs on, rather than at their end.
  /// To the person it is the same as being cut off.
  action _cutOffOnTheWay(person: Person): bool = all {
    _online(person),
    _moveTo(
      opened, place, signedIn, _capacity, _lastTab, _searchedFor, hosting,
      offline.union(Set(person)),
    ),
  }

  /// Every connection comes back.
  action reconnect: bool = all {
    offline != Set(),
    _moveTo(opened, place, signedIn, _capacity, _lastTab, _searchedFor, hosting, Set()),
  }

  /// Checking machinery: the team starts the app on one more machine. Nobody
  /// using the app notices.
  action _gainCapacity: bool = all {
    _capacity < MAX_CAPACITY,
    _moveTo(opened, place, signedIn, _capacity + 1, _lastTab, _searchedFor, hosting, offline),
  }

  /// Checking machinery: the `part`-th machine the app runs on stops; never
  /// the last one. Nobody using the app notices.
  action _loseCapacity(part: int): bool = all {
    _capacity > 1,
    part < _capacity,
    _moveTo(opened, place, signedIn, _capacity - 1, _lastTab, _searchedFor, hosting, offline),
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

  /// What happens to people's connections, and to the machines the app runs
  /// on, underneath them.
  action _worldStep(person: Person, part: int): bool = any {
    cutOff(person),
    _cutOffOnTheWay(person),
    reconnect,
    _gainCapacity,
    _loseCapacity(part),
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

  /// Checking machinery: the app always runs on at least one machine, and
  /// never more than MAX_CAPACITY.
  val invCapacityInBounds = _capacity >= 1 and _capacity <= MAX_CAPACITY

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

  /// Settings remembers a tab the person actually moves between.
  val invSettingsRemembersTheTab = opened.forall(p =>
    place.get(p) == Settings implies
      _lastTab.keys().contains(p) and TABS.contains(_lastTab.get(p))
  )

  /// A search remembers whose name was typed.
  val invSearchRemembersWho = opened.forall(p =>
    place.get(p) == Search implies _searchedFor.keys().contains(p)
  )

  /// A device is cut off only after the person has opened the app.
  val invCutOffOnlyAfterOpening = PEOPLE.forall(p =>
    offline.contains(p) implies opened.contains(p)
  )
}
