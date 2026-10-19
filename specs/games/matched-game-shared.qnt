// Two people play one 5+0 matched game of the game from their own spaces. A
// guest in either space who has a connection sees the same accepted moves
// and the same result as the other person. One game record is offered once
// the matched game is over with a winner, and copying it changes nothing. An
// aborted matched game has no winner and no game record.
// A minute or more with nothing done before both first moves is missing
// the first move: the matched game aborts, nobody won, and nobody can move.
// After both first moves each side has five minutes, and that time runs only
// for the side to move. Running out means the other person won. Being idle
// never makes a move. One minute is not idle, and two minutes is. A device
// with no connection keeps the last board it showed and cannot move or
// resign. Coming back online shows the accepted matched game. A missing
// connection is not idle.
module matched_game_shared {
  pure val ALICE_PHONE = "alice-phone"
  pure val ALICE_COMPUTER = "alice-computer"
  pure val BOB_PHONE = "bob-phone"
  pure val CAROL_PHONE = "carol-phone"
  pure val DAVE_PHONE = "dave-phone"
  pure val DEVICES = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE, CAROL_PHONE, DAVE_PHONE)
  pure val MATCHED = Set(ALICE_PHONE, ALICE_COMPUTER, BOB_PHONE)
  pure val PEOPLE = Set("alice", "bob", "carol", "dave")
  /// Minutes each side starts with in this 5+0 matched game, once both have moved.
  pure val GAME_MINUTES = 5

  /// How many accepted moves each device is showing. An offline device keeps its last number.
  var shownMoves: str -> int
  /// The winner each device is showing, or "nobody" while the matched game is unfinished or aborted.
  var shownWinner: str -> str
  /// Whether that device can make a move. Guests never can. Nobody can once the matched game is over.
  var canMove: str -> bool
  /// Whether the one game record and the final position are offered.
  var gameRecordOffered: bool
  /// Whether each person is idle. A missing connection is not idle.
  var idle: str -> bool

  /// Whether each device has a connection. It starts connected.
  var _online: str -> bool
  /// Uninterrupted quiet minutes on each connected device. Two, added
  /// together, is idle. One is not. A move does not end it. Losing the
  /// connection does.
  var _quiet: str -> int
  var _moves: int
  var _winner: str
  /// Missing the first move, or a minute or more of quiet before both first moves.
  var _aborted: bool
  /// Minutes the first side still has once its clock is running.
  var _firstLeft: int
  /// Minutes the second side still has once its clock is running.
  var _secondLeft: int

  pure def _phone(person: str): str =
    if (person == "bob") BOB_PHONE
    else if (person == "carol") CAROL_PHONE
    else DAVE_PHONE

  pure def _onTurn(device: str, moves: int): bool =
    if (moves % 2 == 0) (device == ALICE_PHONE or device == ALICE_COMPUTER)
    else device == BOB_PHONE

  pure def _canMove(device: str, moves: int, winner: str, online: str -> bool): bool =
    online.get(device) and (winner == "nobody") and _onTurn(device, moves)

  pure def _quietEnough(device: str, quiet: str -> int): bool =
    quiet.get(device) >= 2

  pure def _isIdle(person: str, online: str -> bool, quiet: str -> int): bool =
    if (person == "alice")
      (online.get(ALICE_PHONE) or online.get(ALICE_COMPUTER)) and
      (not(online.get(ALICE_PHONE)) or _quietEnough(ALICE_PHONE, quiet)) and
      (not(online.get(ALICE_COMPUTER)) or _quietEnough(ALICE_COMPUTER, quiet))
    else online.get(_phone(person)) and _quietEnough(_phone(person), quiet)

  pure def _resignerGives(device: str): str =
    if (device == BOB_PHONE) "alice" else "bob"

  pure def _playing(winner: str, aborted: bool): bool =
    (not(aborted) and (winner == "nobody"))

  pure def _clockOn(moves: int, winner: str, aborted: bool): bool =
    (_playing(winner, aborted) and (moves >= 2))

  pure def _firstToMove(moves: int): bool =
    (moves % 2 == 0)

  pure def _abortedAfter(moves: int, winner: str, aborted: bool): bool =
    if (aborted) true
    else if (winner != "nobody") false
    else (moves < 2)

  pure def _flagged(moves: int, winner: str, aborted: bool, left: int, minutes: int): bool =
    (_clockOn(moves, winner, aborted) and ((left - minutes) <= 0))

  pure def _winnerAfter(moves: int, winner: str, aborted: bool, firstLeft: int, secondLeft: int, minutes: int): str =
    if (_flagged(moves, winner, aborted, if (_firstToMove(moves)) firstLeft else secondLeft, minutes))
      (if (_firstToMove(moves)) "bob" else "alice")
    else winner

  pure def _firstAfter(moves: int, winner: str, aborted: bool, firstLeft: int, minutes: int): int =
    if (_clockOn(moves, winner, aborted) and _firstToMove(moves))
      (if ((firstLeft - minutes) < 0) 0 else (firstLeft - minutes))
    else firstLeft

  pure def _secondAfter(moves: int, winner: str, aborted: bool, secondLeft: int, minutes: int): int =
    if (_clockOn(moves, winner, aborted) and not(_firstToMove(moves)))
      (if ((secondLeft - minutes) < 0) 0 else (secondLeft - minutes))
    else secondLeft

  action _record(
    moves: int,
    winner: str,
    online: str -> bool,
    quiet: str -> int,
    aborted: bool,
    firstLeft: int,
    secondLeft: int
  ): bool = all {
    _moves' = moves,
    _winner' = winner,
    _online' = online,
    _quiet' = quiet,
    _aborted' = aborted,
    _firstLeft' = firstLeft,
    _secondLeft' = secondLeft,
    idle' = PEOPLE.mapBy(p => _isIdle(p, online, quiet)),
    canMove' = DEVICES.mapBy(d => (not(aborted) and _canMove(d, moves, winner, online))),
    gameRecordOffered' = (winner != "nobody"),
  }

  action _show(
    moves: int,
    winner: str,
    online: str -> bool,
    quiet: str -> int,
    aborted: bool,
    firstLeft: int,
    secondLeft: int
  ): bool = all {
    _record(moves, winner, online, quiet, aborted, firstLeft, secondLeft),
    shownMoves' = DEVICES.mapBy(d => if (online.get(d)) moves else shownMoves.get(d)),
    shownWinner' = DEVICES.mapBy(d => if (online.get(d)) winner else shownWinner.get(d)),
  }

  action init = all {
    _record(0, "nobody", DEVICES.mapBy(_ => true), DEVICES.mapBy(_ => 0), false, GAME_MINUTES, GAME_MINUTES),
    shownMoves' = DEVICES.mapBy(_ => 0),
    shownWinner' = DEVICES.mapBy(_ => "nobody"),
  }

  /// The person to move plays on a device that has a connection. Both spaces show that one move.
  action playMove(device: str): bool = all {
    not(_aborted),
    _online.get(device),
    MATCHED.contains(device),
    not(device == CAROL_PHONE),
    _winner == "nobody",
    _moves < 2,
    _onTurn(device, _moves),
    _show(_moves + 1, _winner, _online, _quiet, _aborted, _firstLeft, _secondLeft),
  }

  /// After both first moves, a connected device resigns and both spaces share that result.
  action resignGame(device: str): bool = all {
    not(_aborted),
    _online.get(device),
    MATCHED.contains(device),
    _winner == "nobody",
    _moves >= 2,
    _show(_moves, _resignerGives(device), _online, _quiet, false, _firstLeft, _secondLeft),
  }

  /// Time passes with nothing done. Quiet minutes add up. Two is idle; one is not.
  /// Before both first moves, a minute or more aborts the matched game. Afterwards the
  /// side to move spends the minutes, and running out means the other person won.
  action goQuiet(device: str, minutes: int): bool = all {
    DEVICES.contains(device),
    _online.get(device),
    Set(1, 2).contains(minutes),
    _show(
      _moves,
      _winnerAfter(_moves, _winner, _aborted, _firstLeft, _secondLeft, minutes),
      _online,
      _quiet.set(device, _quiet.get(device) + minutes),
      _abortedAfter(_moves, _winner, _aborted),
      _firstAfter(_moves, _winner, _aborted, _firstLeft, minutes),
      _secondAfter(_moves, _winner, _aborted, _secondLeft, minutes),
    ),
  }

  /// This device loses its connection. It keeps the board it was showing, and the matched game is unchanged.
  action loseConnection(device: str): bool = all {
    _online.get(device),
    _show(_moves, _winner, _online.set(device, false), _quiet.set(device, 0), _aborted, _firstLeft, _secondLeft),
  }

  /// This device's connection comes back. It shows the accepted matched game, and it is not idle.
  action connectionReturns(device: str): bool = all {
    not(_online.get(device)),
    _show(_moves, _winner, _online.set(device, true), _quiet.set(device, 0), _aborted, _firstLeft, _secondLeft),
  }

  /// Copying the game record, once the matched game is over with a winner, changes nothing anyone is showing.
  action copyGameRecord(device: str): bool = all {
    DEVICES.contains(device),
    gameRecordOffered,
    _show(_moves, _winner, _online, _quiet, _aborted, _firstLeft, _secondLeft),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet minutes = Set(1, 2).oneOf()
    any {
      playMove(device),
      resignGame(device),
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

  /// The game record is offered exactly when somebody won.
  val invGameRecordNeedsAResult = gameRecordOffered iff (_winner != "nobody")

  /// Missing the first move has no winner, and a win comes only after both first moves.
  val invAbortHasNoWinner = and {
    _aborted implies and {
      _winner == "nobody",
      not(gameRecordOffered),
      _moves < 2,
    },
    (_winner != "nobody") implies ((_moves >= 2) and not(_aborted)),
  }
}
