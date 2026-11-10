// Alice may view the Bot Observatory and watch live. She sees whoever is
// online now, Bob (a person) and Cedar (a Synthetic User), each with its
// activity and whether it is a person or a Synthetic User, and can show only
// people or only Synthetic Users. Someone who closes the app, or whose device
// loses its connection, is no longer online now and drops from her list.
// Alice can watch live anyone online now and sees their place in the app as
// it changes; she never sees a person's private details. Watching live stops
// when the one watched is no longer online now, and Alice is told so.
// With no connection, Alice stops watching live and cannot start again until
// her connection returns.
module live_observatory {
  /// Who is online now.
  var onlineNow: Set[str]
  /// Who Alice sees in her Bot Observatory list.
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
  /// Bookkeeping: whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: watching live has stopped because the one watched was no longer online now.
  var _watchStopped: bool

  pure val PEOPLE = Set("Bob")
  pure val SYNTHETIC_USERS = Set("Cedar")

  pure def _visible(online: Set[str], show: Set[str]): Set[str] =
    online.filter(w => (show.contains("people") and PEOPLE.contains(w)) or (show.contains("Synthetic Users") and SYNTHETIC_USERS.contains(w)))

  pure def _shownPlace(who: str, places: str -> str): str =
    if (who == "") "" else places.get(who)

  action init = all {
    onlineNow' = Set("Bob", "Cedar"),
    listShown' = Set("Bob", "Cedar"),
    showing' = Set("people", "Synthetic Users"),
    placeOf' = Map("Bob" -> "tabs", "Cedar" -> "game"),
    watching' = "",
    placeShown' = "",
    privateDetailsShown' = false,
    watchEndedNotice' = false,
    _offline' = Set(),
    _watchStopped' = false,
  }

  /// Someone opens the app and is online now.
  action openApp(who: str): bool = all {
    not(onlineNow.contains(who)),
    not(_offline.contains(who)),
    onlineNow' = onlineNow.union(Set(who)),
    listShown' = _visible(onlineNow.union(Set(who)), showing),
    showing' = showing,
    placeOf' = placeOf.set(who, "tabs"),
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Someone closes the app; watching them live ends and Alice is told.
  action closeApp(who: str): bool = all {
    onlineNow.contains(who),
    onlineNow' = onlineNow.exclude(Set(who)),
    listShown' = _visible(onlineNow.exclude(Set(who)), showing),
    showing' = showing,
    placeOf' = placeOf,
    watching' = if (watching == who) "" else watching,
    placeShown' = if (watching == who) "" else placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = (watchEndedNotice or watching == who),
    _offline' = _offline,
    _watchStopped' = (_watchStopped or watching == who),
  }

  /// Alice opens the Bot Observatory and sees whoever is online now, filtered as she chose.
  action openObservatory = all {
    not(_offline.contains("Alice")),
    onlineNow' = onlineNow,
    listShown' = _visible(onlineNow, showing),
    showing' = showing,
    placeOf' = placeOf,
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Alice shows only people, only Synthetic Users, or both.
  action showOnly(show: Set[str]): bool = all {
    onlineNow' = onlineNow,
    listShown' = _visible(onlineNow, show),
    showing' = show,
    placeOf' = placeOf,
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Alice watches live someone online now.
  action watchLive(who: str): bool = all {
    onlineNow.contains(who),
    not(_offline.contains("Alice")),
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf,
    watching' = who,
    placeShown' = placeOf.get(who),
    privateDetailsShown' = false,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Bob opens Settings.
  action openSettings = all {
    onlineNow.contains("Bob"),
    not(_offline.contains("Bob")),
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf.set("Bob", "Settings"),
    watching' = watching,
    placeShown' = _shownPlace(watching, placeOf.set("Bob", "Settings")),
    privateDetailsShown' = false,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Bob searches for someone in people search; what he writes is a private detail.
  action searchPeople = all {
    onlineNow.contains("Bob"),
    not(_offline.contains("Bob")),
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf.set("Bob", "people search"),
    watching' = watching,
    placeShown' = _shownPlace(watching, placeOf.set("Bob", "people search")),
    privateDetailsShown' = false,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Cedar continues its current activity in its game.
  action continueActivity = all {
    onlineNow.contains("Cedar"),
    not(_offline.contains("Cedar")),
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf.set("Cedar", "game"),
    watching' = watching,
    placeShown' = _shownPlace(watching, placeOf.set("Cedar", "game")),
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline,
    _watchStopped' = _watchStopped,
  }

  /// Bookkeeping: a device loses its connection; that one is no longer online now.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    onlineNow' = onlineNow.exclude(Set(who)),
    listShown' = _visible(onlineNow.exclude(Set(who)), showing),
    showing' = showing,
    placeOf' = placeOf,
    watching' = if (watching == who or who == "Alice") "" else watching,
    placeShown' = if (watching == who or who == "Alice") "" else placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = (watchEndedNotice or (watching != "" and watching == who)),
    _offline' = _offline.union(Set(who)),
    _watchStopped' = (_watchStopped or (watching != "" and watching == who)),
  }

  /// Bookkeeping: that device's connection comes back.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    onlineNow' = onlineNow,
    listShown' = listShown,
    showing' = showing,
    placeOf' = placeOf,
    watching' = watching,
    placeShown' = placeShown,
    privateDetailsShown' = privateDetailsShown,
    watchEndedNotice' = watchEndedNotice,
    _offline' = _offline.exclude(Set(who)),
    _watchStopped' = _watchStopped,
  }

  action step = {
    nondet who = Set("Bob", "Cedar").oneOf()
    nondet device = Set("Alice", "Bob", "Cedar").oneOf()
    nondet show = Set(Set("people"), Set("Synthetic Users"), Set("people", "Synthetic Users")).oneOf()
    any {
      openObservatory,
      openApp(who),
      closeApp(who),
      showOnly(show),
      watchLive(who),
      openSettings,
      searchPeople,
      continueActivity,
      _loseConnection(device),
      _comeBackOnline(device),
    }
  }

  /// Alice's list shows only those online now, filtered as she chose.
  val invListShowsOnlineNow = listShown == _visible(onlineNow, showing)
  /// Alice watches live only someone online now.
  val invWatchingOnlyOnlineNow = watching == "" or onlineNow.contains(watching)
  /// Watching live shows the watched one's current place in the app.
  val invPlaceShownFollows = placeShown == _shownPlace(watching, placeOf)
  /// Whenever watching live stops because the one watched is no longer online now, Alice is told.
  val invToldWhenWatchEnds = watchEndedNotice == _watchStopped
  /// Watching a person live never shows their private details.
  val invPrivateDetailsHidden = not(privateDetailsShown)
  /// Bookkeeping: someone whose device is offline is not online now, and Alice offline watches nobody.
  val invOfflineNotOnlineNow = _offline.forall(w => not(onlineNow.contains(w))) and (_offline.contains("Alice") implies watching == "")
}
