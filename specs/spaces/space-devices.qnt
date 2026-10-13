// One person can be in a space from more than one device. Presence counts
// that person once. They are idle only when every device of theirs that is
// in the space and has a connection has been quiet for 2 minutes. One minute
// is not enough. A device with no connection is not idle: the person is told
// the connection is missing, and they are still in their place. The host is
// offline for everyone else only when none of the host's devices in the space
// has a connection. The host keeps their own space on an offline device.
// Closing the app on one device does not lose the connection and does not
// end the space. A space created offline is not on the account's other device
// until the connection is back. Two spaces created offline on a free account
// become one space when both devices have a connection again. A Plus member
// keeps both.
//
// What a person can observe: who presence counts, who is idle, how many
// spaces they host, and whether creating another invites them to Plus.
module space_devices {
  pure val ALICE_PHONE = "alice-phone"
  pure val ALICE_COMPUTER = "alice-computer"
  pure val BOB_PHONE = "bob-phone"
  pure val BOB_COMPUTER = "bob-computer"
  pure val DEVICES = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE, BOB_COMPUTER)
  pure val ALICE = Set(ALICE_PHONE, ALICE_COMPUTER)
  pure val BOB = Set(BOB_PHONE, BOB_COMPUTER)
  pure val PEOPLE = Set("alice", "bob")

  /// How many people each person sees in the space, each person at most once.
  var presence: str -> int
  /// Whether each person is idle. Presence shows this. One minute is not idle.
  var idle: str -> bool
  /// How many spaces Alice hosts once her devices agree.
  var hostedSpaces: int
  /// Creating or keeping a second space reached the free hosting limit.
  var invitedToPlus: bool
  /// Whether each device has a connection. It starts connected.
  var _online: str -> bool
  /// "out": not in the space. "in": in it, app open. "closed": app closed, still in it.
  var _place: str -> str
  /// Quiet for 2 minutes on a device that is in the space with a connection.
  var _quiet: str -> bool
  /// Alice's space is open.
  var _open: bool
  /// Alice has Plus.
  var _paid: bool
  var _phoneCreated: bool
  var _computerCreated: bool
  var _phoneOrder: int
  var _computerOrder: int

  pure def _other(device: str): str =
    if (device == ALICE_PHONE) ALICE_COMPUTER else ALICE_PHONE

  pure def _present(place: str -> str, online: str -> bool, device: str): bool =
    online.get(device) and not(place.get(device) == "out")

  pure def _hostUp(place: str -> str, online: str -> bool): bool =
    ALICE.exists(d => _present(place, online, d))

  pure def _aliceThere(place: str -> str, online: str -> bool, open: bool): bool =
    open and (
      _hostUp(place, online) or
      ALICE.exists(d => place.get(d) == "in" and not(online.get(d)))
    )

  pure def _bobThere(place: str -> str, online: str -> bool, open: bool): bool =
    open and _hostUp(place, online) and
    BOB.exists(d => place.get(d) == "in" and online.get(d))

  pure def _presence(place: str -> str, online: str -> bool, open: bool): str -> int =
    PEOPLE.mapBy(p =>
      if (p == "alice") (if (_aliceThere(place, online, open)) 1 else 0)
      else (if (_bobThere(place, online, open)) 1 else 0))

  pure def _looking(place: str -> str, online: str -> bool, device: str): bool =
    place.get(device) == "in" and online.get(device)

  pure def _groupIdle(place: str -> str, online: str -> bool, quiet: str -> bool, devices: Set[str]): bool =
    devices.exists(d => _looking(place, online, d)) and
    devices.forall(d => (_looking(place, online, d) implies quiet.get(d)))

  pure def _idleOf(place: str -> str, online: str -> bool, quiet: str -> bool): str -> bool =
    PEOPLE.mapBy(p =>
      if (p == "alice") _groupIdle(place, online, quiet, ALICE)
      else _groupIdle(place, online, quiet, BOB))

  pure def _countCreates(phoneCreated: bool, computerCreated: bool): int =
    (if (phoneCreated) 1 else 0) + (if (computerCreated) 1 else 0)

  pure def _bothOnline(online: str -> bool): bool =
    online.get(ALICE_PHONE) and online.get(ALICE_COMPUTER)

  pure def _hostedCount(
    phoneCreated: bool,
    computerCreated: bool,
    online: str -> bool,
    paid: bool,
    invited: bool
  ): int =
    if (not(paid) and phoneCreated and computerCreated and (_bothOnline(online) or invited)) 1
    else _countCreates(phoneCreated, computerCreated)

  def _deviceCreated(device: str): bool =
    if (device == ALICE_PHONE) _phoneCreated
    else if (device == ALICE_COMPUTER) _computerCreated
    else false

  def _knows(device: str): bool =
    _deviceCreated(device) or (
      _deviceCreated(_other(device)) and _online.get(_other(device)) and _online.get(device)
    )

  def _blocked(device: str): bool =
    _open and not(_paid) and _online.get(device) and
    _online.get(_other(device)) and _deviceCreated(_other(device))

  action _move(
    place: str -> str,
    online: str -> bool,
    quiet: str -> bool,
    open: bool,
    hosted: int,
    invited: bool,
    phoneCreated: bool,
    computerCreated: bool,
    phoneOrder: int,
    computerOrder: int,
    paid: bool
  ): bool = all {
    presence' = _presence(place, online, open),
    idle' = _idleOf(place, online, quiet),
    hostedSpaces' = hosted,
    invitedToPlus' = invited,
    _online' = online,
    _place' = place,
    _quiet' = quiet,
    _open' = open,
    _paid' = paid,
    _phoneCreated' = phoneCreated,
    _computerCreated' = computerCreated,
    _phoneOrder' = phoneOrder,
    _computerOrder' = computerOrder,
  }

  action _keep(
    place: str -> str,
    online: str -> bool,
    quiet: str -> bool,
    open: bool,
    hosted: int,
    invited: bool
  ): bool =
    _move(
      place, online, quiet, open, hosted, invited,
      _phoneCreated, _computerCreated, _phoneOrder, _computerOrder, _paid
    )

  action init = {
    nondet paid = Set(false, true).oneOf()
    _move(
      DEVICES.mapBy(_ => "out"),
      DEVICES.mapBy(_ => true),
      DEVICES.mapBy(_ => false),
      false,
      0,
      false,
      false,
      false,
      0,
      0,
      paid
    )
  }

  action _refuseCreate: bool =
    _keep(_place, _online, _quiet, _open, hostedSpaces, true)

  action _acceptCreate(device: str): bool = {
    val phoneCreated = _phoneCreated or device == ALICE_PHONE
    val computerCreated = _computerCreated or device == ALICE_COMPUTER
    _move(
      _place.set(device, "in"),
      _online,
      _quiet.set(device, false),
      true,
      _hostedCount(phoneCreated, computerCreated, _online, _paid, invitedToPlus),
      invitedToPlus,
      phoneCreated,
      computerCreated,
      if (device == ALICE_PHONE and _phoneOrder == 0) _phoneOrder + _computerOrder + 1 else _phoneOrder,
      if (device == ALICE_COMPUTER and _computerOrder == 0) _phoneOrder + _computerOrder + 1 else _computerOrder,
      _paid
    )
  }

  /// Start a space on this device, or be invited to Plus when this account already hosts one and both devices have a connection.
  action createSpace(device: str): bool = all {
    ALICE.contains(device),
    not(_deviceCreated(device)),
    if (_blocked(device)) _refuseCreate else _acceptCreate(device),
  }

  /// Return to a space this device already knows. Another device does not know a space created while its host is still offline.
  action returnToSpace(device: str): bool = all {
    ALICE.contains(device),
    not(_place.get(device) == "in"),
    _open,
    _knows(device),
    _keep(_place.set(device, "in"), _online, _quiet.set(device, false), _open, hostedSpaces, invitedToPlus),
  }

  /// Join Alice's open space from a device that has a connection, while the host still has one too.
  action join(device: str): bool = all {
    BOB.contains(device),
    _online.get(device),
    not(_place.get(device) == "in"),
    _place.get(device) == "out",
    _open,
    _hostUp(_place, _online),
    _keep(_place.set(device, "in"), _online, _quiet.set(device, false), _open, hostedSpaces, invitedToPlus),
  }

  /// Look at who is in the space. This works with or without a connection, and the person is not idle afterwards.
  action viewPresence(device: str): bool = all {
    _place.get(device) == "in",
    not(_place.get(device) == "out"),
    _keep(_place, _online, _quiet.set(device, false), _open, hostedSpaces, invitedToPlus),
  }

  /// Time passes with nothing done on this device. Two minutes is idle. One minute is not. A device with no connection cannot become idle.
  action goQuiet(device: str, minutes: int): bool = all {
    _online.get(device),
    _place.get(device) == "in",
    Set(1, 2).contains(minutes),
    if (minutes == 2)
      _keep(_place, _online, _quiet.set(device, true), _open, hostedSpaces, invitedToPlus)
    else
      _keep(_place, _online, _quiet, _open, hostedSpaces, invitedToPlus),
  }

  /// This device loses its connection. The person keeps their place. They are not idle.
  action loseConnection(device: str): bool = all {
    _online.get(device),
    _keep(_place, _online.set(device, false), _quiet.set(device, false), _open, _hostedCount(_phoneCreated, _computerCreated, _online.set(device, false), _paid, invitedToPlus), invitedToPlus),
  }

  /// This device's connection comes back. Two offline spaces on a free account become the earlier one.
  action connectionReturns(device: str): bool = {
    val online = _online.set(device, true)
    val collapse = _phoneCreated and _computerCreated and _bothOnline(online) and not(_paid)
    all {
      not(_online.get(device)),
      _keep(
        _place,
        online,
        _quiet.set(device, false),
        _open,
        _hostedCount(_phoneCreated, _computerCreated, online, _paid, collapse or invitedToPlus),
        collapse or invitedToPlus
      ),
    }
  }

  /// Close the app on this device. The connection stays, the space stays open, and the person stays in it.
  action closeApp(device: str): bool = all {
    _place.get(device) == "in",
    _keep(_place.set(device, "closed"), _online, _quiet.set(device, false), _open, hostedSpaces, invitedToPlus),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet minutes = Set(1, 2).oneOf()
    any {
      createSpace(device),
      returnToSpace(device),
      join(device),
      viewPresence(device),
      goQuiet(device, minutes),
      loseConnection(device),
      connectionReturns(device),
      closeApp(device),
    }
  }

  /// A free account hosts one space once every device that created one has a connection.
  val invOneFreeSpaceOnceDevicesMeet =
    (_phoneCreated and _computerCreated and _online.get(ALICE_PHONE) and _online.get(ALICE_COMPUTER) and not(_paid))
      implies (hostedSpaces == 1 and invitedToPlus)

  /// Nobody is idle unless one of their devices is in the space, connected, and quiet.
  val invIdleNeedsAConnection =
    idle.get("alice") implies ALICE.exists(d => _place.get(d) == "in" and _online.get(d) and _quiet.get(d))

  /// Other people see nobody when the host has no connected device in the space.
  val invGuestsLeavePresenceWhenHostIsOffline =
    not(ALICE.exists(d => not(_place.get(d) == "out") and _online.get(d))) implies presence.get("bob") == 0

  /// A host who is in the space only on devices with no connection still sees herself.
  val invHostSeesHerselfOffline =
    (ALICE.exists(d => _place.get(d) == "in") and not(ALICE.exists(d => _place.get(d) == "in" and _online.get(d))))
      implies presence.get("alice") == 1

  /// Presence counts a person once.
  val invPersonCountedOnce = presence.get("alice") <= 1 and presence.get("bob") <= 1
}
