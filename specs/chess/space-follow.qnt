// Everyone in a space sees what its host last chose, on every device they
// have in the space. The host's other device chooses for the whole space.
// A guest's choice does nothing. A device with no connection cannot choose,
// and what the space shows stays the host's last choice. Being idle does
// not change it. Coming back online shows that same choice.
module space_follow {
  pure val ALICE_PHONE = "alice-phone"
  pure val ALICE_COMPUTER = "alice-computer"
  pure val BOB_PHONE = "bob-phone"
  pure val DEVICES = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE)
  pure val HOSTS = Set(ALICE_PHONE, ALICE_COMPUTER)

  /// What each device in the space is showing: "choice" (the game choice) or "chess".
  var view: str -> str
  /// Whether each device has a connection. It starts connected.
  var _online: str -> bool
  /// Whether each device is in the space.
  var _in: str -> bool

  action _show(views: str -> str, online: str -> bool, inside: str -> bool): bool = all {
    view' = views,
    _online' = online,
    _in' = inside,
  }

  /// The choice an online device in the space is showing. A device with no
  /// connection keeps what it was showing until it comes back.
  pure def _agreed(online: str -> bool, inside: str -> bool, shown: str -> str, device: str): str =
    if (online.get(ALICE_PHONE) and inside.get(ALICE_PHONE) and not(device == ALICE_PHONE)) shown.get(ALICE_PHONE)
    else if (online.get(ALICE_COMPUTER) and inside.get(ALICE_COMPUTER) and not(device == ALICE_COMPUTER)) shown.get(ALICE_COMPUTER)
    else if (online.get(BOB_PHONE) and inside.get(BOB_PHONE) and not(device == BOB_PHONE)) shown.get(BOB_PHONE)
    else shown.get(device)

  action _apply(shown: str): bool =
    _show(DEVICES.mapBy(d => if (_in.get(d) and _online.get(d)) shown else view.get(d)), _online, _in)

  action init =
    _show(
      DEVICES.mapBy(_ => "choice"),
      DEVICES.mapBy(_ => true),
      DEVICES.mapBy(_ => true)
    )

  /// The host picks chess. Every device in the space shows it. A guest or an offline device cannot.
  action pickChess(device: str): bool = all {
    HOSTS.contains(device),
    _online.get(device),
    _in.get(device),
    not(view.get(device) == "chess"),
    not(device == BOB_PHONE),
    _apply("chess"),
  }

  /// The host goes back to the game choice. A guest or an offline device cannot.
  action backToGameChoice(device: str): bool = all {
    HOSTS.contains(device),
    _online.get(device),
    _in.get(device),
    view.get(device) == "chess",
    not(device == BOB_PHONE),
    _apply("choice"),
  }

  /// Time passes with nothing done. What the space shows does not change, and the person is not choosing.
  action goQuiet(device: str): bool = all {
    DEVICES.contains(device),
    _online.get(device),
    _in.get(device),
    _show(view, _online, _in),
  }

  /// This device loses its connection. What the space shows stays as it was.
  action loseConnection(device: str): bool = all {
    _online.get(device),
    _show(view, _online.set(device, false), _in),
  }

  /// This device's connection comes back. It shows the same choice as the other devices in the space.
  action connectionReturns(device: str): bool = all {
    not(_online.get(device)),
    _show(view.set(device, _agreed(_online, _in, view, device)), _online.set(device, true), _in),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    any {
      pickChess(device),
      backToGameChoice(device),
      goQuiet(device),
      loseConnection(device),
      connectionReturns(device),
    }
  }

  /// Devices that are in the space and have a connection show one choice.
  val invOnlineDevicesShareOneView =
    DEVICES.forall(a => DEVICES.forall(b =>
      (_online.get(a) and _online.get(b) and _in.get(a) and _in.get(b)) implies
        view.get(a) == view.get(b)))
}
