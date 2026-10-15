// Alice and Bob keep one rated multiplayer game after their opening moves.
// An interruption of shared play pauses both clocks. Their own devices may
// independently go offline: that alone spends the ordinary time on turn.
// Returning never creates a different game, repeats a move or rates a result
// twice. A completed result survives every interruption. The same rules apply
// to a daily game, whose move starts the other person's full allowance.
module shared_clock_recovery {
  pure val PEOPLE = Set("alice", "bob")
  pure val SPEEDS = Set("bullet", "blitz", "rapid", "classical", "daily")
  pure val ALLOWANCES = Map("bullet" -> 60, "blitz" -> 300, "rapid" -> 600, "classical" -> 1800, "daily" -> 86400)
  pure val WAITS = Set(1, 60, 86400)
  /// The agreed speed, kept throughout this game.
  var speed: str
  /// The accepted number of moves; the opening has already been played.
  var moves: int
  /// The person whose turn it is.
  var turn: str
  /// The seconds remaining on each person's agreed clock.
  var timeLeft: str -> int
  /// Whether shared play has paused the clocks, rather than a person going away.
  var clocksPaused: bool
  /// The accepted winner, or nobody while the game is unfinished.
  var winner: str
  /// How many finished rated games this game contributes to each person's count.
  var ratedGames: str -> int
  /// Whether a finished game record is offered.
  var gameRecordOffered: bool
  /// Whether each person's device can currently play its turn.
  var canMove: str -> bool
  var _available: bool
  var _online: str -> bool
  var _firstWinner: str
  var _previousTime: str -> int
  var _previousPaused: bool
  var _previousWinner: str
  var _previousMoves: int

  def _allowance: int = ALLOWANCES.get(speed)
  pure def _other(person: str): str = if (person == "alice") "bob" else "alice"
  action _show(plies: int, onTurn: str, left: str -> int, won: str, available: bool, online: str -> bool): bool = all {
    speed' = speed, moves' = plies, turn' = onTurn, timeLeft' = left,
    winner' = won, _available' = available, _online' = online,
    clocksPaused' = (won == "" and not(available)),
    canMove' = PEOPLE.mapBy(p => won == "" and available and online.get(p) and onTurn == p),
    ratedGames' = PEOPLE.mapBy(_ => if (won == "") 0 else 1),
    gameRecordOffered' = won != "",
    _firstWinner' = if (_firstWinner == "") won else _firstWinner,
    _previousTime' = timeLeft, _previousPaused' = clocksPaused,
    _previousWinner' = winner, _previousMoves' = moves,
  }
  action init = {
    nondet chosenSpeed = SPEEDS.oneOf()
    val seconds = ALLOWANCES.get(chosenSpeed)
    all {
      speed' = chosenSpeed, moves' = 2, turn' = "alice",
      timeLeft' = PEOPLE.mapBy(_ => seconds), clocksPaused' = false,
      winner' = "", ratedGames' = PEOPLE.mapBy(_ => 0),
      gameRecordOffered' = false, canMove' = Map("alice" -> true, "bob" -> false),
      _available' = true, _online' = PEOPLE.mapBy(_ => true), _firstWinner' = "",
      _previousTime' = PEOPLE.mapBy(_ => seconds), _previousPaused' = false,
      _previousWinner' = "", _previousMoves' = 2,
    }
  }
  /// The connected person to move plays the next legal opening move.
  action playMove(person: str): bool = all {
    winner == "", moves < 4,
    if (canMove.get(person))
      _show(moves + 1, _other(person),
        if (speed == "daily") PEOPLE.mapBy(_ => _allowance) else timeLeft,
        winner, _available, _online)
    else _show(moves, turn, timeLeft, winner, _available, _online),
  }
  /// A participating person can resign an available unfinished game.
  action resignPlay(person: str): bool =
    _show(moves, turn, timeLeft,
      if (winner == "" and _available and _online.get(person)) _other(person) else winner,
      _available, _online)
  /// Time cannot be spent during a shared pause; disconnected people still spend it otherwise.
  action multiplayerTimePasses(seconds: int): bool = {
    val left = timeLeft.get(turn)
    val spent = winner == "" and _available
    val remaining = if (spent) (if (seconds >= left) 0 else left - seconds) else left
    _show(moves, turn, timeLeft.set(turn, remaining),
      if (spent and remaining == 0) _other(turn) else winner, _available, _online)
  }
  /// A person opens the accepted game or its lasting record.
  action openMultiplayer(person: str): bool = _show(moves, turn, timeLeft, winner, _available, _online)
  /// One person's own connection is lost; the shared game remains available.
  action loseConnection(person: str): bool = all {
    _online.get(person),
    _show(moves, turn, timeLeft, winner, _available, _online.set(person, false)),
  }
  /// A person's own connection returns, including while shared play is still paused.
  action comeBackOnline(person: str): bool = all {
    not(_online.get(person)),
    _show(moves, turn, timeLeft, winner, _available, _online.set(person, true)),
  }
  /// Checking machinery: shared play is interrupted for everyone, independently of their devices.
  action _sharedPlayStops = all {
    _available, _show(moves, turn, timeLeft, winner, false, _online),
  }
  /// Checking machinery: shared play becomes usable again without giving back spent time.
  action _sharedPlayReturns = all {
    not(_available), _show(moves, turn, timeLeft, winner, true, _online),
  }
  action step = {
    nondet person = PEOPLE.oneOf()
    nondet seconds = WAITS.oneOf()
    any { playMove(person), resignPlay(person), multiplayerTimePasses(seconds),
      openMultiplayer(person), loseConnection(person), comeBackOnline(person),
      _sharedPlayStops, _sharedPlayReturns }
  }
  /// A pause spends no time, accepts no move and cannot decide a winner.
  val invPauseKeepsGame = _previousPaused implies and {
    timeLeft == _previousTime, moves == _previousMoves, winner == _previousWinner,
  }
  /// The accepted result is permanent and contributes exactly one rated game for each person.
  val invResultIsCountedOnce = PEOPLE.forall(p => ratedGames.get(p) == (if (winner == "") 0 else 1)) and
    (_firstWinner != "" implies winner == _firstWinner)
  /// Finished games alone offer a finished game record; none has a clock to resume.
  val invFinishedRecordIsHonest = gameRecordOffered == (winner != "") and
    (winner != "" implies not(clocksPaused))
  /// Nobody can move while shared play is paused or their own device is offline.
  val invOnlyUsableTurnCanMove = PEOPLE.forall(p => canMove.get(p) ==
    (winner == "" and _available and _online.get(p) and turn == p))
  /// A move is part of the same alternating game, at the agreed speed.
  val invSameGame = SPEEDS.contains(speed) and moves >= 2 and moves <= 4 and
    turn == (if (moves % 2 == 0) "alice" else "bob")
  /// In a daily game the person not to move shows the full days for a move.
  val invDailyClockKeepsFullDays = speed == "daily" implies timeLeft.get(_other(turn)) == _allowance
  /// No clock is negative, including when a deadline passes during return.
  val invClocksAreNonnegative = PEOPLE.forall(p => timeLeft.get(p) >= 0)
  /// A disconnected person cannot move even while the shared game remains available.
  val invOfflineCannotMove = PEOPLE.forall(p => not(_online.get(p)) implies not(canMove.get(p)))
  /// A shared pause is shown exactly while the unfinished game itself cannot be played.
  val invPauseIsShown = clocksPaused == (winner == "" and not(_available))
  val _state = (speed, moves, turn, timeLeft, clocksPaused, winner, ratedGames,
    gameRecordOffered, canMove, _available, _online, _firstWinner, _previousTime,
    _previousPaused, _previousWinner, _previousMoves)
}
