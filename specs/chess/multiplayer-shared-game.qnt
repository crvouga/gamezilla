// Two people play one multiplayer game from their own spaces. A guest in
// either space who has a connection sees the same accepted moves and the
// same result as the other person. One game record is offered once the
// game is over, and copying it changes nothing.
// A device with no connection keeps the last board it showed and cannot
// move or resign. Coming back online shows the accepted game. Being idle
// changes nothing about the game: one minute is not idle, and two minutes is.
module multiplayer_shared_game {
  pure val ALICE_PHONE = "alice-phone"
  pure val ALICE_COMPUTER = "alice-computer"
  pure val BOB_PHONE = "bob-phone"
  pure val CAROL_PHONE = "carol-phone"
  pure val DAVE_PHONE = "dave-phone"
  pure val DEVICES = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE, CAROL_PHONE, DAVE_PHONE)
  pure val MATCHED = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE)
  pure val PEOPLE = Set("alice", "bob", "carol", "dave")

  /// How many accepted moves each device is showing. An offline device keeps its last number.
  var shownMoves: str -> int
  /// The winner each device is showing, or "nobody" while the game is unfinished.
  var shownWinner: str -> str
  /// Whether that device can move a piece. Guests never can.
  var canMove: str -> bool
  /// Whether the one game record and the final position are offered.
  var gameRecordOffered: bool
  /// Whether each person is idle. A missing connection is not idle.
  var idle: str -> bool

  /// Whether each device has a connection. It starts connected.
  var _online: str -> bool
  /// Whether each connected device has been quiet for 2 minutes.
  var _quiet: str -> bool
  var _moves: int
  var _winner: str

  pure def _phone(person: str): str =
    if (person == "bob") BOB_PHONE
    else if (person == "carol") CAROL_PHONE
    else DAVE_PHONE

  pure def _onTurn(device: str, moves: int): bool =
    if (moves % 2 == 0) (device == ALICE_PHONE or device == ALICE_COMPUTER)
    else device == BOB_PHONE

  pure def _canMove(device: str, moves: int, winner: str, online: str -> bool): bool =
    online.get(device) and (winner == "nobody") and _onTurn(device, moves)

  pure def _isIdle(person: str, online: str -> bool, quiet: str -> bool): bool =
    if (person == "alice")
      (online.get(ALICE_PHONE) or online.get(ALICE_COMPUTER)) and
      (not(online.get(ALICE_PHONE)) or quiet.get(ALICE_PHONE)) and
      (not(online.get(ALICE_COMPUTER)) or quiet.get(ALICE_COMPUTER))
    else online.get(_phone(person)) and quiet.get(_phone(person))

  pure def _resignerGives(device: str): str =
    if (device == BOB_PHONE) "alice" else "bob"

  action _show(moves: int, winner: str, online: str -> bool, quiet: str -> bool): bool = all {
    _moves' = moves,
    _winner' = winner,
    _online' = online,
    _quiet' = quiet,
    idle' = PEOPLE.mapBy(p => _isIdle(p, online, quiet)),
    shownMoves' = DEVICES.mapBy(d => if (online.get(d)) moves else shownMoves.get(d)),
    shownWinner' = DEVICES.mapBy(d => if (online.get(d)) winner else shownWinner.get(d)),
    canMove' = DEVICES.mapBy(d => _canMove(d, moves, winner, online)),
    gameRecordOffered' = (winner != "nobody"),
  }

  action init = all {
    _moves' = 0,
    _winner' = "nobody",
    _online' = DEVICES.mapBy(_ => true),
    _quiet' = DEVICES.mapBy(_ => false),
    idle' = PEOPLE.mapBy(_ => false),
    shownMoves' = DEVICES.mapBy(_ => 0),
    shownWinner' = DEVICES.mapBy(_ => "nobody"),
    canMove' = DEVICES.mapBy(d => d == ALICE_PHONE or d == ALICE_COMPUTER),
    gameRecordOffered' = false,
  }

  /// The person to move plays on a device that has a connection. Both spaces show that one move.
  action playMove(device: str): bool = all {
    _online.get(device),
    MATCHED.contains(device),
    not(device == CAROL_PHONE),
    _winner == "nobody",
    _moves < 2,
    _onTurn(device, _moves),
    _show(_moves + 1, _winner, _online, _quiet),
  }

  /// After both first moves, a connected device resigns and both spaces share that result.
  action resignPlay(device: str): bool = all {
    _online.get(device),
    MATCHED.contains(device),
    _winner == "nobody",
    _moves >= 2,
    _show(_moves, _resignerGives(device), _online, _quiet),
  }

  /// Time passes with nothing done. Two minutes is idle; one minute is not. The game does not change.
  action goQuiet(device: str, minutes: int): bool = all {
    DEVICES.contains(device),
    _online.get(device),
    Set(1, 2).contains(minutes),
    _show(_moves, _winner, _online, if (minutes == 2) _quiet.set(device, true) else _quiet),
  }

  /// This device loses its connection. It keeps the board it was showing, and the game is unchanged.
  action loseConnection(device: str): bool = all {
    _online.get(device),
    _show(_moves, _winner, _online.set(device, false), _quiet.set(device, false)),
  }

  /// This device's connection comes back. It shows the accepted game, and it is not idle.
  action connectionReturns(device: str): bool = all {
    not(_online.get(device)),
    _show(_moves, _winner, _online.set(device, true), _quiet.set(device, false)),
  }

  /// Copying the game record, once the game is over, changes nothing anyone is showing.
  action copyGameRecord(device: str): bool = all {
    DEVICES.contains(device),
    gameRecordOffered,
    _show(_moves, _winner, _online, _quiet),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet minutes = Set(1, 2).oneOf()
    any {
      playMove(device),
      resignPlay(device),
      goQuiet(device, minutes),
      loseConnection(device),
      connectionReturns(device),
      copyGameRecord(device),
    }
  }

  /// Devices that have a connection show the same accepted moves and the same result.
  val invOnlineDevicesShareTheGame =
    DEVICES.forall(a => DEVICES.forall(b =>
      (_online.get(a) and _online.get(b)) implies and {
        shownMoves.get(a) == _moves,
        shownWinner.get(a) == _winner,
        shownMoves.get(a) == shownMoves.get(b),
      }))

  /// A person is idle only while some device of theirs still has a connection.
  val invIdleNeedsAConnection = and {
    idle.get("alice") implies (_online.get(ALICE_PHONE) or _online.get(ALICE_COMPUTER)),
    idle.get("bob") implies _online.get(BOB_PHONE),
    idle.get("carol") implies _online.get(CAROL_PHONE),
    idle.get("dave") implies _online.get(DAVE_PHONE),
  }

  /// Guests never gain a side.
  val invGuestsCannotMove = and {
    canMove.get(CAROL_PHONE) == false,
    canMove.get(DAVE_PHONE) == false,
  }

  /// The game record is offered exactly when the game is over with a result.
  val invGameRecordNeedsAResult = gameRecordOffered iff (_winner != "nobody")
}
