// How many spaces a person hosts.
//
// Alice creates spaces and returns to them from the lobby. Without paid
// access she may host one; with paid access there is no hosting limit.
// Ending a space frees its place. When paid access ends, every existing
// space stays open and usable, but creating another is refused until she
// is below the free hosting limit.
// Hosting, ending and returning work while offline. Losing and regaining
// the connection never ends a space or changes the hosting limit.
//
// Alice observes where she is, how many spaces her lobby lists, and whether
// creating another invites her to Plus.
module hosting_limits {
  type Whereabouts = Lobby | InSpace | Ended

  /// Where Alice is: her lobby, a space she hosts, or one she has ended.
  var whereabouts: Whereabouts
  /// How many spaces the lobby shows; outside the lobby this is not shown.
  var hostedSpaces: int
  /// Creating another has reached the hosting limit and offers Plus.
  var invitedToPlus: bool
  /// The open spaces Alice hosts, counted even while she is in one of them.
  var _count: int
  /// Whether Alice has paid access.
  var _paid: bool
  /// Whether Alice's device has no connection.
  var _offline: bool
  /// The spaces and place Alice chose on her own device.
  var _chosenCount: int
  var _chosenPlace: Whereabouts
  /// The last change was paid access ending, and the count before it ended.
  var _lastPaidEnding: bool
  var _countBeforePaidEnding: int

  action _update(count: int, paid: bool, place: Whereabouts, invited: bool): bool = all {
    whereabouts' = place,
    hostedSpaces' = if (place == Lobby) count else 0,
    invitedToPlus' = invited,
    _count' = count,
    _paid' = paid,
    _offline' = _offline,
    _chosenCount' = count, _chosenPlace' = place,
    _lastPaidEnding' = false,
    _countBeforePaidEnding' = count,
  }

  action init = all {
    whereabouts' = Lobby, hostedSpaces' = 0, invitedToPlus' = false,
    _count' = 0, _paid' = false,
    _offline' = false,
    _chosenCount' = 0, _chosenPlace' = Lobby,
    _lastPaidEnding' = false, _countBeforePaidEnding' = 0,
  }

  /// Create a space from the lobby, or be invited to Plus at the hosting limit.
  action createSpace: bool = all {
    whereabouts == Lobby,
    if (_paid or _count < 1)
      _update(_count + 1, _paid, InSpace, false)
    else _update(_count, _paid, Lobby, true),
  }

  /// Step out to the lobby; every open space remains there.
  action stepOut: bool = all {
    whereabouts == InSpace,
    _update(_count, _paid, Lobby, false),
  }

  /// Return to an existing space, with or without paid access.
  action returnToSpace: bool = all {
    whereabouts == Lobby,
    _count > 0,
    _update(_count, _paid, InSpace, false),
  }

  /// End the space Alice is in, freeing its place without ending the others.
  action endSpace: bool = all {
    whereabouts == InSpace,
    _update(_count - 1, _paid, Ended, false),
  }

  /// Go back to the lobby from a space that has ended.
  action goBackToLobby: bool = all {
    whereabouts == Ended,
    _update(_count, _paid, Lobby, false),
  }

  /// Alice gains paid access and can create more spaces.
  action PaidAccessStarted: bool = all {
    not(_paid),
    not(_offline),
    _update(_count, true, whereabouts, false),
  }

  /// Paid access ends; every space Alice already hosts stays open.
  action PaidAccessEnded: bool = all {
    _paid,
    whereabouts' = whereabouts,
    hostedSpaces' = hostedSpaces,
    invitedToPlus' = invitedToPlus,
    _count' = _count,
    _paid' = false,
    _offline' = _offline,
    _chosenCount' = _chosenCount, _chosenPlace' = _chosenPlace,
    _lastPaidEnding' = true,
    _countBeforePaidEnding' = _count,
  }

  action _connection(offline: bool): bool = all {
    whereabouts' = whereabouts, hostedSpaces' = hostedSpaces,
    invitedToPlus' = invitedToPlus, _count' = _count, _paid' = _paid,
    _offline' = offline,
    _chosenCount' = _chosenCount, _chosenPlace' = _chosenPlace,
    _lastPaidEnding' = false, _countBeforePaidEnding' = _count,
  }

  /// Alice's device loses its connection; her spaces remain usable.
  action loseConnection: bool = all { not(_offline), _connection(true) }

  /// Alice's connection returns; the same spaces are still open.
  action connectionReturns: bool = all { _offline, _connection(false) }

  action step = any {
    createSpace, stepOut, returnToSpace, endSpace, goBackToLobby,
    PaidAccessStarted, PaidAccessEnded,
    loseConnection, connectionReturns,
  }

  /// A person never hosts fewer than zero spaces.
  val invNonnegativeCount = _count >= 0
  /// The lobby counts every open space, including those retained after paid access ends.
  val invLobbyListsAllHosted = hostedSpaces == (if (whereabouts == Lobby) _count else 0)
  /// Alice is in a space only while she hosts at least one open space.
  val invInsideAnOpenSpace = whereabouts == InSpace implies _count > 0
  /// Paid access ending never ends an existing space.
  val invPaidEndingKeepsSpaces = _lastPaidEnding implies _count == _countBeforePaidEnding
  /// An invitation to Plus follows an attempted creation at the free hosting limit.
  val invInvitationAtLimit = invitedToPlus implies all { whereabouts == Lobby, not(_paid), _count >= 1 }
  /// While offline, Alice keeps the spaces and place she chose on her own device.
  val invOfflineKeepsOwnChoices = _offline implies all { _count == _chosenCount, whereabouts == _chosenPlace }

  // The promises hold however many spaces Alice hosts and however often access changes.
  val _inductive = all {
    whereabouts.in(Set(Lobby, InSpace, Ended)),
    _count >= 0, _countBeforePaidEnding >= 0,
    _count == _chosenCount, whereabouts == _chosenPlace,
    invNonnegativeCount, invLobbyListsAllHosted,
    invInsideAnOpenSpace, invPaidEndingKeepsSpaces,
    invInvitationAtLimit,
    invOfflineKeepsOwnChoices,
  }
}
