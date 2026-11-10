// Alice may view the User Observatory and watch live. She sees whoever is
// online now, Bob (a person) and Cedar (a Synthetic User), each with its
// activity and whether it is a person or a Synthetic User, and can show only
// people or only Synthetic Users. Whoever has the app open with a connection
// is online now: someone who closes the app, or whose device loses its
// connection, drops from her list, and someone whose app is still open is
// back on it once their connection returns.
// Alice can watch live anyone online now and sees their place in the app as
// it changes; she never sees a person's private details, such as the email
// address on a sign-in method. Watching live stops when the one watched is no
// longer online now, and Alice is told so.
// With no connection, Alice keeps her last known list and what she last saw
// while watching, is told the connection is missing, and cannot open the Bot
// Observatory, change what it shows or start watching live until her
// connection returns; then her list and watching show who is online now
// again.
module user_observatory {
  /// Who is online now.
  var onlineNow: Set[str]
  /// Who Alice sees in her User Observatory list.
  var listShown: Set[str]
  /// Which kinds of those online now Alice shows: people, Synthetic Users, or both.
  var showing: Set[str]
  /// Each one's place in the app.
  var placeOf: str -> str
  /// Who Alice is watching live, or "" for nobody.
  var watching: str
  /// The place in the app Alice sees while watching live, or "" for none.
  var placeShown: str
  /// Whether Alice sees any of Bob's private details.
  var privateDetailsShown: bool
  /// Whether Alice has been told the one she watched is no longer online now.
  var watchEndedNotice: bool
  /// Whether Alice's device has its connection (without it she is told the connection is missing).
  var connectionAvailable: bool
  /// Bookkeeping: whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: whose app is open, with or without a connection.
  var _appOpen: Set[str]
  /// Bookkeeping: watching live has stopped because the one watched was no longer online now.
  var _watchStopped: bool
  /// Bookkeeping: Alice's list and watched place when her connection went.
  var _listBeforeOffline: Set[str]
  var _placeBeforeOffline: str

  pure val PEOPLE = Set("Bob")
  pure val SYNTHETIC_USERS = Set("Cedar")

  pure def _visible(online: Set[str], show: Set[str]): Set[str] =
    online.filter(w => (show.contains("people") and PEOPLE.contains(w)) or (show.contains("Synthetic Users") and SYNTHETIC_USERS.contains(w)))

  pure def _shownPlace(who: str, places: str -> str): str =
    if (who == "") "" else places.get(who)

  /// Bookkeeping: whether the one watched has just stopped being online now.
  pure def _stops(who: str, online: Set[str]): bool =
    who != "" and not(online.contains(who))

  pure def _stillWatched(who: str, online: Set[str]): str =
    if (_stops(who, online)) "" else who

  action init = all {
    onlineNow' = Set("Bob", "Cedar"),
    listShown' = Set("Bob", "Cedar"),
    showing' = Set("people", "Synthetic Users"),
    placeOf' = Map("Bob" -> "tabs", "Cedar" -> "game"),
    watching' = "",
    placeShown' = "",
    privateDetailsShown' = false,
    watchEndedNotice' = false,
    connectionAvailable' = true,
    _offline' = Set(),
    _appOpen' = Set("Bob", "Cedar"),
    _watchStopped' = false,
    _listBeforeOffline' = Set(),
    _placeBeforeOffline' = "",
  }

  /// Bookkeeping: what Alice sees after who is online now, or where they are, changes.
  /// Connected, her view follows at once; offline, she keeps her last known view.
  action _worldChanges(online: Set[str], places: str -> str, appOpen: Set[str], offline: Set[str]): bool = all {
    onlineNow' = online,
    listShown' = if (connectionAvailable) _visible(online, showing) else listShown,
    showing' = showing,
    placeOf' = places,
    watching' = if (connectionAvailable) _stillWatched(watching, online) else watching,
    placeShown' = if (connectionAvailable) _shownPlace(_stillWatched(watching, online), places) else placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = (watchEndedNotice or (connectionAvailable and _stops(watching, online))),
    connectionAvailable' = connectionAvailable,
    _offline' = offline,
    _appOpen' = appOpen,
    _watchStopped' = (_watchStopped or (connectionAvailable and _stops(watching, online))),
    _listBeforeOffline' = _listBeforeOffline,
    _placeBeforeOffline' = _placeBeforeOffline,
  }

  /// Someone opens the app and, with a connection, is online now.
  action openApp(who: str): bool = all {
    not(_appOpen.contains(who)),
    not(_offline.contains(who)),
    _worldChanges(onlineNow.union(Set(who)), placeOf.set(who, "tabs"), _appOpen.union(Set(who)), _offline),
  }

  /// Someone closes the app and is no longer online now; watching them live stops and Alice is told.
  action closeApp(who: str): bool = all {
    _appOpen.contains(who),
    _worldChanges(onlineNow.exclude(Set(who)), placeOf, _appOpen.exclude(Set(who)), _offline),
  }

  /// Bob opens Settings.
  action openSettings = all {
    onlineNow.contains("Bob"),
    _worldChanges(onlineNow, placeOf.set("Bob", "Settings"), _appOpen, _offline),
  }

  /// Bob looks at his sign-in methods, where the email address of each is shown to him.
  action viewSignInMethods = all {
    onlineNow.contains("Bob"),
    _worldChanges(onlineNow, placeOf.set("Bob", "sign-in methods"), _appOpen, _offline),
  }

  /// Bob searches for someone in people search; what he writes is a private detail.
  action searchPeople = all {
    onlineNow.contains("Bob"),
    _worldChanges(onlineNow, placeOf.set("Bob", "people search"), _appOpen, _offline),
  }

  /// Cedar continues its current activity in its game.
  action continueActivity = all {
    onlineNow.contains("Cedar"),
    _worldChanges(onlineNow, placeOf.set("Cedar", "game"), _appOpen, _offline),
  }

  /// Alice opens the User Observatory and sees whoever is online now, filtered as she chose.
  action openObservatory = all {
    connectionAvailable,
    onlineNow' = onlineNow,
    listShown' = _visible(onlineNow, showing),
    showing' = showing,
    placeOf' = placeOf,
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    connectionAvailable' = connectionAvailable,
    _offline' = _offline,
    _appOpen' = _appOpen,
    _watchStopped' = _watchStopped,
    _listBeforeOffline' = _listBeforeOffline,
    _placeBeforeOffline' = _placeBeforeOffline,
  }

  /// Alice shows only people, only Synthetic Users, or both.
  action showOnly(show: Set[str]): bool = all {
    connectionAvailable,
    onlineNow' = onlineNow,
    listShown' = _visible(onlineNow, show),
    showing' = show,
    placeOf' = placeOf,
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    connectionAvailable' = connectionAvailable,
    _offline' = _offline,
    _appOpen' = _appOpen,
    _watchStopped' = _watchStopped,
    _listBeforeOffline' = _listBeforeOffline,
    _placeBeforeOffline' = _placeBeforeOffline,
  }

  /// Alice watches live someone online now.
  action watchLive(who: str): bool = all {
    connectionAvailable,
    onlineNow.contains(who),
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf,
    watching' = who,
    placeShown' = placeOf.get(who),
    privateDetailsShown' = false,
    watchEndedNotice' = watchEndedNotice,
    connectionAvailable' = connectionAvailable,
    _offline' = _offline,
    _appOpen' = _appOpen,
    _watchStopped' = _watchStopped,
    _listBeforeOffline' = _listBeforeOffline,
    _placeBeforeOffline' = _placeBeforeOffline,
  }

  /// Bookkeeping: Alice's device loses its connection; she keeps her last known view.
  action _aliceLosesConnection = all {
    connectionAvailable,
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf,
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    connectionAvailable' = false,
    _offline' = _offline.union(Set("Alice")),
    _appOpen' = _appOpen,
    _watchStopped' = _watchStopped,
    _listBeforeOffline' = listShown,
    _placeBeforeOffline' = placeShown,
  }

  /// Bookkeeping: Alice's connection comes back; her list and watching show who is online now again.
  action _aliceComesBackOnline = all {
    not(connectionAvailable),
    onlineNow' = onlineNow,
    listShown' = _visible(onlineNow, showing),
    showing' = showing,
    placeOf' = placeOf,
    watching' = _stillWatched(watching, onlineNow),
    placeShown' = _shownPlace(_stillWatched(watching, onlineNow), placeOf),
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = (watchEndedNotice or _stops(watching, onlineNow)),
    connectionAvailable' = true,
    _offline' = _offline.exclude(Set("Alice")),
    _appOpen' = _appOpen,
    _watchStopped' = (_watchStopped or _stops(watching, onlineNow)),
    _listBeforeOffline' = _listBeforeOffline,
    _placeBeforeOffline' = _placeBeforeOffline,
  }

  /// Bookkeeping: Bob's or Cedar's device loses its connection; they are no longer online now.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    _worldChanges(onlineNow.exclude(Set(who)), placeOf, _appOpen, _offline.union(Set(who))),
  }

  /// Bookkeeping: that device's connection comes back; with the app still open, they are online now again.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    _worldChanges(
      if (_appOpen.contains(who)) onlineNow.union(Set(who)) else onlineNow,
      placeOf, _appOpen, _offline.exclude(Set(who))),
  }

  action step = {
    nondet who = Set("Bob", "Cedar").oneOf()
    nondet show = Set(Set("people"), Set("Synthetic Users"), Set("people", "Synthetic Users")).oneOf()
    any {
      openObservatory,
      openApp(who),
      closeApp(who),
      showOnly(show),
      watchLive(who),
      openSettings,
      viewSignInMethods,
      searchPeople,
      continueActivity,
      _aliceLosesConnection,
      _aliceComesBackOnline,
      _loseConnection(who),
      _comeBackOnline(who),
    }
  }

  /// Whoever has the app open with a connection is online now, and nobody else.
  val invOnlineNowMeansAppOpenAndConnected = onlineNow == _appOpen.filter(w => not(_offline.contains(w)))
  /// With her connection, Alice's list shows those online now, filtered as she chose.
  val invListShowsOnlineNow = connectionAvailable implies (listShown == _visible(onlineNow, showing))
  /// With her connection, Alice watches live only someone online now.
  val invWatchingOnlyOnlineNow = connectionAvailable implies (watching == "" or onlineNow.contains(watching))
  /// With her connection, watching live shows the watched one's current place in the app.
  val invPlaceShownFollows = connectionAvailable implies (placeShown == _shownPlace(watching, placeOf))
  /// Whenever watching live stops because the one watched is no longer online now, Alice is told.
  val invToldWhenWatchEnds = watchEndedNotice == _watchStopped
  /// Watching a person live never shows their private details.
  val invPrivateDetailsHidden = not(privateDetailsShown)
  /// Without her connection, Alice keeps her last known list and what she last saw while watching.
  val invOfflineKeepsLastKnown = (not(connectionAvailable)) implies (listShown == _listBeforeOffline and placeShown == _placeBeforeOffline)
  /// Bookkeeping: Alice's connection matches her device, and nobody offline is online now.
  val invOfflineNotOnlineNow = (_offline.contains("Alice") implies not(connectionAvailable)) and (not(_offline.contains("Alice")) implies connectionAvailable) and _offline.forall(w => not(onlineNow.contains(w)))
}
