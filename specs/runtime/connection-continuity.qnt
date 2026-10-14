// Alice can go elsewhere and keep the saved theme while a choice involving
// other people has not finished. A missing connection never takes away her
// place. She can put that choice aside, reopen the app or use Settings.
// A refused choice never happens merely because a connection returns.
// A choice whose answer was lost remains unfinished until its outcome is known.
module connection_continuity {
  pure val PLACES = Set("spaces", "profile", "settings")
  /// Alice's current place in the app.
  var place: str
  /// The saved preference still shown while another choice has not finished.
  var theme: str
  /// Whether the unfinished choice is still in front of Alice.
  var choiceOpen: bool
  /// Whether the choice has yet to receive a clear outcome.
  var choiceUnfinished: bool
  /// Whether Alice can find confirmation that this choice succeeded.
  var choiceConfirmed: bool
  /// Whether Alice is told the connection is missing.
  var connectionMissing: bool
  /// Whether Alice can put the choice aside.
  var canPutAside: bool
  var _online: bool
  var _available: bool
  var _refused: bool
  var _accepted: bool
  var _placeAtLoss: str
  var _lostConnection: bool

  action _show(where: str, open: bool, unfinished: bool, confirmed: bool,
    online: bool, available: bool, refused: bool, accepted: bool): bool = all {
    place' = where, theme' = theme, choiceOpen' = open,
    choiceUnfinished' = unfinished, choiceConfirmed' = confirmed,
    connectionMissing' = not(online and available), canPutAside' = open,
    _online' = online, _available' = available,
    _refused' = refused, _accepted' = accepted,
    _placeAtLoss' = if (_online and _available and not(online and available)) place else _placeAtLoss,
    _lostConnection' = (where == place and (_lostConnection or (_online and _available and not(online and available)))),
  }
  action init = all {
    place' = "spaces", theme' = "dark", choiceOpen' = true,
    choiceUnfinished' = true, choiceConfirmed' = false,
    connectionMissing' = false, canPutAside' = true,
    _online' = true, _available' = true, _refused' = false, _accepted' = false,
    _placeAtLoss' = "spaces", _lostConnection' = false,
  }
  /// Alice opens another tab, regardless of the unfinished choice.
  action openTab(tab: str): bool =
    _show(tab, false, choiceUnfinished, choiceConfirmed, _online, _available, _refused, _accepted)
  /// Alice reaches Settings while the choice remains unresolved elsewhere.
  action openSettings: bool =
    _show("settings", false, choiceUnfinished, choiceConfirmed, _online, _available, _refused, _accepted)
  /// Alice puts aside the unfinished choice without claiming it succeeded or was cancelled.
  action putAsideChoice: bool = all {
    choiceOpen, _show(place, false, choiceUnfinished, choiceConfirmed, _online, _available, _refused, _accepted),
  }
  /// Closing and reopening keeps the place, preference and known outcome.
  action reopen: bool = _show(place, false, choiceUnfinished, choiceConfirmed, _online, _available, _refused, _accepted)
  /// One device loses its connection independently of shared availability.
  action cutOff: bool = all {
    _online, _show(place, choiceOpen, choiceUnfinished, choiceConfirmed, false, _available, _refused, _accepted),
  }
  /// The connection returns without deciding a refused choice.
  action reconnect: bool = all {
    not(_online), _show(place, choiceOpen, choiceUnfinished, choiceConfirmed, true, _available, _refused, _accepted),
  }
  /// Checking machinery: a shared choice cannot finish even though the device has a connection.
  action _sharedChoiceStops = all {
    _available, _show(place, choiceOpen, choiceUnfinished, choiceConfirmed, _online, false, _refused, _accepted),
  }
  /// Checking machinery: shared choices are available again without deciding a refused choice.
  action _sharedChoiceReturns = all {
    not(_available), _show(place, choiceOpen, choiceUnfinished, choiceConfirmed, _online, true, _refused, _accepted),
  }
  /// Checking machinery: the choice receives an accepted answer while it remains usable.
  action _choiceAccepted = all {
    choiceUnfinished, _online, _available, not(_refused),
    _show(place, choiceOpen, false, true, _online, _available, false, true),
  }
  /// Checking machinery: the choice is refused before acceptance, with a clear reason.
  action _choiceRefused = all {
    choiceUnfinished, not(_accepted),
    _show(place, choiceOpen, false, false, _online, _available, true, false),
  }
  /// Checking machinery: an already-issued choice counts but its answer is not heard.
  action _choiceAcceptedWithoutHearing = all {
    choiceUnfinished, _available, not(_refused), not(_accepted),
    _show(place, choiceOpen, true, false, _online, _available, false, true),
  }
  /// Checking machinery: the accepted choice is finally confirmed after return.
  action _choiceOutcomeKnown = all {
    choiceUnfinished, _online, _available, _accepted,
    _show(place, choiceOpen, false, true, _online, _available, false, true),
  }
  action step = {
    nondet tab = Set("spaces", "profile").oneOf()
    any { openTab(tab), openSettings, putAsideChoice, reopen, cutOff, reconnect,
      _sharedChoiceStops, _sharedChoiceReturns, _choiceAccepted,
      _choiceRefused, _choiceAcceptedWithoutHearing, _choiceOutcomeKnown }
  }
  /// Missing connections keep the saved preference and every local place reachable.
  val invLocalAppIsKept = PLACES.contains(place) and theme == "dark"
  /// Nobody is told an unaccepted choice succeeded.
  val invConfirmationIsHonest = choiceConfirmed implies _accepted
  /// A refusal never becomes an accepted choice merely on return.
  val invRefusedChoiceStaysRefused = _refused implies not(_accepted) and not(choiceConfirmed)
  /// An unfinished choice can always be put aside while it is in front of the person.
  val invChoiceNeverTraps = canPutAside == choiceOpen
  /// People see the missing connection even when only shared availability was lost.
  val invMissingConnectionIsShown = connectionMissing == not(_online and _available)
  /// Losing a connection without choosing another place keeps that place.
  val invLossKeepsPlace = _lostConnection implies place == _placeAtLoss
  /// A confirmed or refused choice no longer claims to be unfinished.
  val invOutcomeStopsWaiting = (choiceConfirmed or _refused) implies not(choiceUnfinished)
  /// A device with no connection still shows the saved preference and names the missing connection.
  val invOfflineKeepsLocalUse = not(_online) implies (theme == "dark" and connectionMissing)
  val _state = (place, theme, choiceOpen, choiceUnfinished, choiceConfirmed,
    connectionMissing, canPutAside, _online, _available, _refused, _accepted,
    _placeAtLoss, _lostConnection)
}
