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

  /// What each device is showing: "choice", "chess", or "host offline".
  var view: str -> str
  /// Whether each device has a connection. It starts connected.
  var _online: str -> bool
  /// Whether each device is in the space.
  var _in: str -> bool

  /// The host's last choice. An offline device keeps what it was showing
  /// until its connection comes back, and then shows this. A guest whose
  /// connection is up is told the host is offline only when no host device
  /// in the space has a connection.
  var _choice: str

  /// Some host device in the space still has a connection.
  pure def _hostUp(online: str -> bool, inside: str -> bool): bool =
    HOSTS.exists(d => online.get(d) and inside.get(d))

  action _show(
    shown: str -> str,
    online: str -> bool,
    inside: str -> bool,
    choice: str,
  ): bool = all {
    view' = shown,
    _online' = online,
    _in' = inside,
    _choice' = choice,
  }

  /// Online devices show the host's last choice while a host device is
  /// connected. An offline device keeps what it was already showing. A
  /// guest with a connection, and no host device connected, is told the
  /// host is offline.
  action _paint(
    online: str -> bool,
    inside: str -> bool,
    choice: str,
  ): bool =
    _show(
      DEVICES.mapBy(d =>
        if (not(online.get(d))) view.get(d)
        else if (_hostUp(online, inside) or HOSTS.contains(d)) choice
        else "host offline"),
      online,
      inside,
      choice,
    )

  action _apply(shown: str): bool = _paint(_online, _in, shown)

  action init =
    _show(
      DEVICES.mapBy(_ => "choice"),
      DEVICES.mapBy(_ => true),
      DEVICES.mapBy(_ => true),
      "choice",
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
    _paint(_online, _in, _choice),
  }

  /// This device loses its connection. What it was showing stays as it was.
  /// Everyone still connected is told the host is offline only when no host
  /// device remains connected.
  action loseConnection(device: str): bool = all {
    _online.get(device),
    _paint(_online.set(device, false), _in, _choice),
  }

  /// This device's connection comes back. It shows the host's last choice
  /// when a host device is connected, and is told the host is offline when
  /// none is.
  action connectionReturns(device: str): bool = all {
    not(_online.get(device)),
    _paint(_online.set(device, true), _in, _choice),
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
