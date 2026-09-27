// The whole app on its platform.
//
// Alice, Bob and Carol each open the app on their own device and land on the
// Spaces tab, as guests. From the tabs a person can move between Spaces,
// Notifications and Profile, open Settings and come back to the tab they left.
// A guest can sign in with Google and then has an account whose username is
// their own name. Anyone, guest or not, can host a space and later end it.
// People search finds people with an account by username, never the searcher
// themselves, and asks a guest to sign in instead.
//
// Meanwhile the world moves underneath them: a device can lose its connection
// (to a server, or at the load balancer) until the connection comes back, and
// the fleet of API servers grows and shrinks, never below one and at most
// three. Losing the connection never throws anyone out of where they are;
// what needs the server (signing in, searching, hosting and ending a space)
// waits until they are back online.
module app_platform {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// The tabs a person moves between.
  pure val TABS: Set[str] = Set("spaces", "notifications", "profile")

  pure val MAX_SERVERS: int = 3

  /// OnTab(tab): on one of the tabs; Settings: on Settings; Search: on people
  /// search with a name typed; InSpace: in the space they host; Ended: looking
  /// at the space they just ended.
  type Screen =
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
  /// What each open device shows.
  var screen: Person -> Screen
  /// Who is signed in to an account (everyone else who opened the app is a guest).
  var signedIn: Set[Person]
  /// What each person on people search sees.
  var lookup: Person -> Lookup
  /// How many API servers are live.
  var servers: int

  // Bookkeeping, not on screen.
  /// The tab a person left for Settings.
  var lastTab: Person -> str
  /// The name each person on people search typed.
  var query: Person -> Person
  /// Who is hosting a live space.
  var hosting: Set[Person]
  /// Whose device is cut off.
  var offline: Set[Person]

  pure def looking(
    screen: Person -> Screen,
    query: Person -> Person,
    signedIn: Set[Person],
  ): Person -> Lookup =
    screen.keys().filter(p => screen.get(p) == Search).mapBy(p =>
      if (not(signedIn.contains(p))) Denied
      else if (query.get(p) == p or not(signedIn.contains(query.get(p)))) Nobody
      else Shows(query.get(p))
    )

  action moveTo(
    newOpened: Set[Person],
    newScreen: Person -> Screen,
    newSignedIn: Set[Person],
    newServers: int,
    newLastTab: Person -> str,
    newQuery: Person -> Person,
    newHosting: Set[Person],
    newOffline: Set[Person],
  ): bool = all {
    opened' = newOpened,
    screen' = newScreen,
    signedIn' = newSignedIn,
    lookup' = looking(newScreen, newQuery, newSignedIn),
    servers' = newServers,
    lastTab' = newLastTab,
    query' = newQuery,
    hosting' = newHosting,
    offline' = newOffline,
  }

  /// A person's screen changes; nothing else does.
  action show(person: Person, s: Screen): bool =
    moveTo(opened, screen.set(person, s), signedIn, servers, lastTab, query, hosting, offline)

  /// Alice has signed in on her device and Bob is using the app as a guest;
  /// one API server is live.
  action init = moveTo(
    Set("alice", "bob"),
    Map("alice" -> OnTab("spaces"), "bob" -> OnTab("spaces")),
    Set("alice"),
    1,
    Map(),
    Map(),
    Set(),
    Set(),
  )

  pure def onTab(s: Screen): bool = match s {
    | OnTab(_) => true
    | _ => false
  }

  pure def tabOf(s: Screen): str = match s {
    | OnTab(t) => t
    | _ => ""
  }

  def online(person: Person): bool =
    opened.contains(person) and not(offline.contains(person))

  /// Opening the app lands a guest on the Spaces tab.
  action open(person: Person): bool = all {
    not(opened.contains(person)),
    moveTo(
      opened.union(Set(person)),
      screen.put(person, OnTab("spaces")),
      signedIn, servers, lastTab, query, hosting, offline,
    ),
  }

  /// Tap a tab: from any tab, from Settings, search or an ended space.
  action openTab(person: Person, tab: str): bool = all {
    opened.contains(person),
    screen.get(person) != InSpace,
    show(person, OnTab(tab)),
  }

  action openSettings(person: Person): bool = all {
    opened.contains(person),
    onTab(screen.get(person)),
    moveTo(
      opened, screen.set(person, Settings), signedIn, servers,
      lastTab.put(person, tabOf(screen.get(person))), query, hosting, offline,
    ),
  }

  /// Back from Settings to the tab the person left.
  action leaveSettings(person: Person): bool = all {
    opened.contains(person),
    screen.get(person) == Settings,
    show(person, OnTab(lastTab.get(person))),
  }

  /// A guest signs in with Google from the tabs, and comes back to them.
  action signIn(person: Person): bool = all {
    online(person),
    not(signedIn.contains(person)),
    onTab(screen.get(person)),
    // Search results are what the search found when it ran.
    screen.keys().forall(p => screen.get(p) == Search implies query.get(p) != person),
    moveTo(
      opened, screen, signedIn.union(Set(person)), servers, lastTab, query,
      hosting, offline,
    ),
  }

  /// Search people for someone's username, from the tabs.
  action lookUp(person: Person, other: Person): bool = all {
    online(person),
    onTab(screen.get(person)) or screen.get(person) == Search,
    moveTo(
      opened, screen.set(person, Search), signedIn, servers, lastTab,
      query.put(person, other), hosting, offline,
    ),
  }

  /// Host a space: the person is in it.
  action host(person: Person): bool = all {
    online(person),
    not(hosting.contains(person)),
    screen.get(person) != InSpace,
    moveTo(
      opened, screen.set(person, InSpace), signedIn, servers, lastTab, query,
      hosting.union(Set(person)), offline,
    ),
  }

  /// The host ends their space and sees that it has ended.
  action end(person: Person): bool = all {
    online(person),
    screen.get(person) == InSpace,
    moveTo(
      opened, screen.set(person, Ended), signedIn, servers, lastTab, query,
      hosting.exclude(Set(person)), offline,
    ),
  }

  /// The device loses its connection to the server.
  action cutOff(person: Person): bool = all {
    online(person),
    moveTo(
      opened, screen, signedIn, servers, lastTab, query, hosting,
      offline.union(Set(person)),
    ),
  }

  /// The load balancer cuts the device off from every server.
  action cutAtBalancer(person: Person): bool = all {
    online(person),
    moveTo(
      opened, screen, signedIn, servers, lastTab, query, hosting,
      offline.union(Set(person)),
    ),
  }

  /// Every connection comes back.
  action reconnect: bool = all {
    offline != Set(),
    moveTo(opened, screen, signedIn, servers, lastTab, query, hosting, Set()),
  }

  action addServer: bool = all {
    servers < MAX_SERVERS,
    moveTo(opened, screen, signedIn, servers + 1, lastTab, query, hosting, offline),
  }

  /// Retire the `node`-th live server; never the last one.
  action dropServer(node: int): bool = all {
    servers > 1,
    node < servers,
    moveTo(opened, screen, signedIn, servers - 1, lastTab, query, hosting, offline),
  }

  /// What a person does on their device.
  action personStep(person: Person, other: Person, tab: str): bool = any {
    open(person),
    openTab(person, tab),
    openSettings(person),
    leaveSettings(person),
    signIn(person),
    lookUp(person, other),
    host(person),
    end(person),
  }

  /// What happens to the network and the fleet underneath them.
  action worldStep(person: Person, node: int): bool = any {
    cutOff(person),
    cutAtBalancer(person),
    reconnect,
    addServer,
    dropServer(node),
  }

  /// People act three times as often as the world moves under them.
  action step = {
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    nondet tab = TABS.oneOf()
    nondet node = 0.to(MAX_SERVERS - 1).oneOf()
    any {
      personStep(person, other, tab),
      personStep(person, other, tab),
      personStep(person, other, tab),
      worldStep(person, node),
    }
  }

  /// At least one API server is live, and never more than the fleet allows.
  val invFleetSize = servers >= 1 and servers <= MAX_SERVERS

  /// Only people who opened the app have a screen, an account or a connection.
  val invOnlyOpened = and {
    screen.keys() == opened,
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
  val invInSpaceHosts = opened.forall(p => screen.get(p) == InSpace implies hosting.contains(p))
}
