// A person with an unfinished game is always one step from its board.
// Alice hosts a space. Either Alice and Bob, a guest in her space, have a
// custom game under way there that Carol watches; or Alice has an unfinished
// matched game with Bob, who plays it from his own space, while Carol is a
// guest in Alice's space. Alice also has another device.
// While a custom game is under way in a space, the space stays on its board:
// every device in it shows the board, and the host is not offered going back
// to the game choice. A matched game does not hold the space: its host may
// take the space elsewhere, since a daily game can last for days.
// Wherever a participant's device is, in the space or in the lobby, it shows
// the board or offers to return to their game, and returning shows the board
// on that device in one step. Seeking an opponent is never offered to someone
// with an unfinished game; returning to their game is offered in its place.
// A watcher has no game to return to. Once the game is finished, nobody is
// offered a return and the hosts are offered seeking an opponent again.
// A device without a connection keeps what it showed; when the connection
// comes back it shows what is true now.
module unfinished_game_return {
  pure val ALICE_PHONE = "alice-phone"
  pure val ALICE_COMPUTER = "alice-computer"
  pure val BOB_PHONE = "bob-phone"
  pure val CAROL_PHONE = "carol-phone"
  pure val DEVICES = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE, CAROL_PHONE)
  pure val PARTICIPANT_DEVICES = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE)
  pure val KINDS = Set("custom", "matched")

  /// What each device shows: "board" (the game's board), "choices" (the
  /// space's game choice or one of the game's choices), or "lobby".
  var view: str -> str
  /// Whether each device offers to return to their game.
  var returnOffered: str -> bool
  /// Whether each device offers seeking an opponent.
  var seekOffered: str -> bool

  /// The unfinished game: "custom" or "matched", or "none" once it is finished.
  var _game: str
  /// Which kind of game it was, kept after it finishes.
  var _kind: str
  /// Whether each device has a connection. It starts connected.
  var _online: str -> bool
  /// Whether each device is in its space rather than in the lobby.
  var _inside: str -> bool
  /// What each space shows: Alice's space ("alice") and, in a matched game,
  /// Bob's own space ("bob").
  var _spaceView: str -> str

  pure def _spaceOf(kind: str, device: str): str =
    if (kind == "matched" and device == BOB_PHONE) "bob" else "alice"

  /// The host of the space the device is in.
  pure def _hosting(kind: str, device: str): bool =
    device == ALICE_PHONE or device == ALICE_COMPUTER or
      (kind == "matched" and device == BOB_PHONE)

  pure def _unfinishedFor(game: str, device: str): bool =
    game != "none" and PARTICIPANT_DEVICES.contains(device)

  pure def _shown(kind: str, inside: str -> bool, spaces: str -> str, device: str): str =
    if (not(inside.get(device))) "lobby" else spaces.get(_spaceOf(kind, device))

  /// Every connected device shows what is true now; a device without a
  /// connection keeps what it showed.
  action _paint(
    game: str,
    online: str -> bool,
    inside: str -> bool,
    spaces: str -> str,
  ): bool = all {
    view' = DEVICES.mapBy(d =>
      if (not(online.get(d))) view.get(d) else _shown(_kind, inside, spaces, d)),
    returnOffered' = DEVICES.mapBy(d =>
      if (not(online.get(d))) returnOffered.get(d)
      else _unfinishedFor(game, d) and _shown(_kind, inside, spaces, d) != "board"),
    seekOffered' = DEVICES.mapBy(d =>
      if (not(online.get(d))) seekOffered.get(d)
      else _hosting(_kind, d) and not(_unfinishedFor(game, d)) and
        _shown(_kind, inside, spaces, d) == "choices"),
    _game' = game,
    _kind' = _kind,
    _online' = online,
    _inside' = inside,
    _spaceView' = spaces,
  }

  action init = {
    nondet kind = KINDS.oneOf()
    all {
      _kind' = kind,
      _game' = kind,
      _online' = DEVICES.mapBy(_ => true),
      _inside' = DEVICES.mapBy(_ => true),
      _spaceView' = Map("alice" -> "board", "bob" -> "board"),
      view' = DEVICES.mapBy(_ => "board"),
      returnOffered' = DEVICES.mapBy(_ => false),
      seekOffered' = DEVICES.mapBy(_ => false),
    }
  }

  /// The host takes their space back to the game choice. Not while a custom
  /// game is under way in it.
  action backToGameChoice(device: str): bool = all {
    _online.get(device),
    _inside.get(device),
    _hosting(_kind, device),
    _spaceView.get(_spaceOf(_kind, device)) == "board",
    not(_game == "custom" and _spaceOf(_kind, device) == "alice"),
    _paint(_game, _online, _inside, _spaceView.set(_spaceOf(_kind, device), "choices")),
  }

  /// The device goes back to the lobby without leaving the space.
  action goBackToLobby(device: str): bool = all {
    _online.get(device),
    _inside.get(device),
    _paint(_game, _online, _inside.set(device, false), _spaceView),
  }

  /// A host's device returns to their space from the lobby.
  action returnToSpace(device: str): bool = all {
    _online.get(device),
    not(_inside.get(device)),
    _hosting(_kind, device),
    _paint(_game, _online, _inside.set(device, true), _spaceView),
  }

  /// A participant returns to their game: that device shows its board, in the
  /// space it is played in.
  action returnToGame(device: str): bool = all {
    _online.get(device),
    returnOffered.get(device),
    _paint(
      _game,
      _online,
      _inside.set(device, true),
      _spaceView.set(_spaceOf(_kind, device), "board"),
    ),
  }

  /// A participant on the board resigns, and the game is finished.
  action resignGame(device: str): bool = all {
    _online.get(device),
    _unfinishedFor(_game, device),
    view.get(device) == "board",
    _paint("none", _online, _inside, _spaceView),
  }

  /// The person closes and reopens the app on this device. It opens where it
  /// was, showing what is true now.
  action reopenApp(device: str): bool = all {
    _online.get(device),
    _paint(_game, _online, _inside, _spaceView),
  }

  /// This device loses its connection and keeps what it showed.
  action loseConnection(device: str): bool = all {
    _online.get(device),
    _paint(_game, _online.set(device, false), _inside, _spaceView),
  }

  /// This device's connection comes back and it shows what is true now.
  action connectionReturns(device: str): bool = all {
    not(_online.get(device)),
    _paint(_game, _online.set(device, true), _inside, _spaceView),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    any {
      backToGameChoice(device),
      goBackToLobby(device),
      returnToSpace(device),
      returnToGame(device),
      resignGame(device),
      reopenApp(device),
      loseConnection(device),
      connectionReturns(device),
    }
  }

  /// A connected device of someone with an unfinished game shows its board or
  /// offers to return to it.
  val invOneStepFromTheGame =
    DEVICES.forall(d =>
      (_online.get(d) and _unfinishedFor(_game, d)) implies
        (view.get(d) == "board" or returnOffered.get(d)))

  /// Returning is offered only to a participant whose game is unfinished.
  val invNothingToReturnToIsOffered =
    DEVICES.forall(d =>
      (_online.get(d) and returnOffered.get(d)) implies _unfinishedFor(_game, d))

  /// Seeking an opponent is never offered to someone with an unfinished game.
  val invBlockedSeekingIsNotOffered =
    DEVICES.forall(d =>
      (_online.get(d) and seekOffered.get(d)) implies not(_unfinishedFor(_game, d)))

  /// While a custom game is under way, every connected device in its space
  /// shows its board.
  val invCustomGameKeepsItsSpace =
    _game == "custom" implies
      DEVICES.forall(d => (_online.get(d) and _inside.get(d)) implies view.get(d) == "board")
}
