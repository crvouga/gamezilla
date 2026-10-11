// Alice and Bob are matched for one daily game: a multiplayer game in which
// each of them has three days for every move. Alice is White. Each of them
// uses one device, and either device can lose its connection and get it back.
//
// The days of the person whose turn it is run from the start of the game,
// whoever is connected. A move hands the full three days to the other
// person; unused days are never saved up. Missing the first move aborts the
// game. Once both people have moved, the person who runs out of time loses,
// and either person may resign; before that either may abort instead. The
// moves follow one of three games: an ordinary opening, Fool's Mate, in
// which Black checkmates on the fourth move, and both knights going out and
// home twice, which draws the game on the eighth move by repetition.
//
// The person whose turn it is has one turn notice in their inbox, unread
// until they open it. It leaves when their own move is accepted or the game
// is over or aborted, and their next turn brings it back unread. When that
// person's multiplayer clock becomes low on time, with one day left, and
// they have not moved, the same turn notice comes back unread as a turn
// reminder, once per turn. When the game is over or aborted, both people
// get a result notice saying how it ended for them: won, lost, drawn or
// aborted. Each keeps theirs until they dismiss it. Opening a turn notice
// or a result notice shows the person their daily game; it never moves a
// piece and never ends anything.
//
// With no connection a person keeps the board, the multiplayer clocks and
// the inbox their device last showed. They cannot move, resign, abort or
// dismiss a result notice, and opening a turn notice or a result notice
// shows that last board and changes nothing. The game and its clocks go on
// without them. Once they are back online they see the game as it now
// stands, with the turn notice or result notice that became theirs
// meanwhile.
//
// Time passes here in whole days and one game is played. Draw offers,
// rematches, ratings and the draw of a person who runs out of time against
// someone unable to checkmate follow multiplayer chess.
module daily_game {
  type PlayOutcome = NoPlay | OngoingPlay | WonPlay(str) | DrawnPlay | AbortedPlay
  type DailyGame = {
    moves: int, outcome: PlayOutcome, daysLeft: int, history: int,
    opened: Set[str], dismissed: Set[str]
  }
  type LastKnownPlay = {
    moveCount: int, turn: str, playOutcome: PlayOutcome,
    whiteClock: int, blackClock: int, turnNotice: str, turnReminder: bool,
    resultNotice: str
  }

  pure val PEOPLE = Set("alice", "bob")
  pure val WHITE = "alice"
  pure val BLACK = "bob"
  pure val DAYS_PER_MOVE = 3
  pure val REMINDER_DAYS = 1
  pure val PASSING_DAYS = Set(1, 2, 3)
  pure val HISTORIES = Set(0, 1, 2)
  pure val MOST_MOVES = 8
  pure val NOBODY = "nobody"
  pure val NO_GAME: DailyGame = {
    moves: 0, outcome: NoPlay, daysLeft: 0, history: -1, opened: Set(), dismissed: Set()
  }
  pure val FIRST_VIEW: LastKnownPlay = {
    moveCount: 0, turn: NOBODY, playOutcome: NoPlay,
    whiteClock: 0, blackClock: 0, turnNotice: "none", turnReminder: false,
    resultNotice: "none"
  }

  /// How many accepted moves each person's device shows on the daily game's board.
  var moveCount: str -> int
  /// Who may move next, or nobody before the game starts and once it is over or aborted.
  var turn: str -> str
  /// No game yet, an unfinished game, its multiplayer result, or that it was aborted.
  var playOutcome: str -> PlayOutcome
  /// Whole days left on White's and on Black's multiplayer clock.
  var whiteClock: str -> int
  var blackClock: str -> int
  /// The turn notice in each person's inbox: "none", "unread" or "opened".
  var turnNotice: str -> str
  /// Whether each person's turn notice is a turn reminder: it tells them
  /// their multiplayer clock is low on time, with one day or less left.
  var turnReminder: str -> bool
  /// The result notice in each person's inbox: "none", "won", "lost", "drawn" or "aborted".
  var resultNotice: str -> str

  var _game: DailyGame
  var _offline: Set[str]
  var _lastKnown: str -> LastKnownPlay

  pure def _other(p: str): str = if (p == WHITE) BLACK else WHITE
  pure def _turnOf(g: DailyGame): str =
    if (g.outcome != OngoingPlay) NOBODY else if (g.moves % 2 == 0) WHITE else BLACK
  pure def _over(o: PlayOutcome): bool = o != NoPlay and o != OngoingPlay

  /// What one person sees on a connected device. The side to move shows the
  /// days it has left; the other side shows the full days.
  pure def _view(g: DailyGame, p: str): LastKnownPlay = {
    moveCount: g.moves, turn: _turnOf(g), playOutcome: g.outcome,
    whiteClock: if (g.outcome == NoPlay) 0 else if (g.moves % 2 == 0) g.daysLeft else DAYS_PER_MOVE,
    blackClock: if (g.outcome == NoPlay) 0 else if (g.moves % 2 == 1) g.daysLeft else DAYS_PER_MOVE,
    turnNotice: if (_turnOf(g) != p) "none" else if (g.opened.contains(p)) "opened" else "unread",
    turnReminder: _turnOf(g) == p and g.daysLeft <= REMINDER_DAYS,
    resultNotice: if (g.dismissed.contains(p)) "none"
      else if (g.outcome == WonPlay(p)) "won"
      else if (g.outcome == WonPlay(_other(p))) "lost"
      else if (g.outcome == DrawnPlay) "drawn"
      else if (g.outcome == AbortedPlay) "aborted"
      else "none"
  }

  /// Days passing in the game: a missed first move aborts it, and once both
  /// people have moved the side to move loses when its days run out. When
  /// the side to move becomes low on time, its turn notice comes back unread
  /// as a turn reminder; that happens once per turn.
  pure def _tick(g: DailyGame, days: int): DailyGame =
    if (g.outcome != OngoingPlay) g
    else if (g.daysLeft > days) { ...g, daysLeft: g.daysLeft - days,
      opened: if (g.daysLeft > REMINDER_DAYS and g.daysLeft - days <= REMINDER_DAYS)
        g.opened.exclude(Set(_turnOf(g))) else g.opened }
    else if (g.moves < 2) { ...g, daysLeft: 0, outcome: AbortedPlay }
    else { ...g, daysLeft: 0, outcome: WonPlay(_other(_turnOf(g))) }

  def _canAct(p: str): bool = not(_offline.contains(p))

  action _show(g: DailyGame, offline: Set[str]): bool = {
    val shown = PEOPLE.mapBy(p => if (offline.contains(p)) _lastKnown.get(p) else _view(g, p))
    all {
      _game' = g, _offline' = offline, _lastKnown' = shown,
      moveCount' = PEOPLE.mapBy(p => shown.get(p).moveCount),
      turn' = PEOPLE.mapBy(p => shown.get(p).turn),
      playOutcome' = PEOPLE.mapBy(p => shown.get(p).playOutcome),
      whiteClock' = PEOPLE.mapBy(p => shown.get(p).whiteClock),
      blackClock' = PEOPLE.mapBy(p => shown.get(p).blackClock),
      turnNotice' = PEOPLE.mapBy(p => shown.get(p).turnNotice),
      turnReminder' = PEOPLE.mapBy(p => shown.get(p).turnReminder),
      resultNotice' = PEOPLE.mapBy(p => shown.get(p).resultNotice),
    }
  }

  action init = all {
    _game' = NO_GAME, _offline' = Set(), _lastKnown' = PEOPLE.mapBy(_ => FIRST_VIEW),
    moveCount' = PEOPLE.mapBy(_ => 0), turn' = PEOPLE.mapBy(_ => NOBODY),
    playOutcome' = PEOPLE.mapBy(_ => NoPlay),
    whiteClock' = PEOPLE.mapBy(_ => 0), blackClock' = PEOPLE.mapBy(_ => 0),
    turnNotice' = PEOPLE.mapBy(_ => "none"), turnReminder' = PEOPLE.mapBy(_ => false),
    resultNotice' = PEOPLE.mapBy(_ => "none"),
  }

  /// Matchmaking has already chosen Alice and Bob, who both asked for three
  /// days per move. Their daily game starts: White has the full days and a
  /// turn notice.
  action matchFormed: bool = all {
    _game.outcome == NoPlay,
    _show({ ...NO_GAME, outcome: OngoingPlay, daysLeft: DAYS_PER_MOVE }, _offline),
  }

  /// A legal move on one's turn counts once and hands the full days to the
  /// other person, whose turn notice comes back unread. The first move
  /// chooses which of the three games is played: Fool's Mate ends with
  /// Black's checkmate on the fourth move, and the knights' game is drawn on
  /// the eighth. Bounded here to eight accepted moves.
  action playMove(person: str, history: int): bool = {
    val counts = and {
      _canAct(person), _turnOf(_game) == person,
      _game.history == -1 or _game.history == history,
    }
    val outcome = if (history == 1 and _game.moves == 3) WonPlay(BLACK)
      else if (history == 2 and _game.moves == 7) DrawnPlay else OngoingPlay
    all {
      not(counts) or _game.moves < MOST_MOVES,
      _show(if (counts) { ..._game,
        moves: _game.moves + 1, outcome: outcome, daysLeft: DAYS_PER_MOVE,
        history: history, opened: Set() }
        else _game, _offline),
    }
  }

  /// Once both people have made their first move, either person can resign
  /// the unfinished game; before that they abort instead.
  action resignPlay(person: str): bool = {
    val resigns = _canAct(person) and _game.outcome == OngoingPlay and _game.moves >= 2
    _show(if (resigns) { ..._game, outcome: WonPlay(_other(person)) } else _game, _offline)
  }

  /// Either person may abort until both have made their first move.
  action abortPlay(person: str): bool = {
    val aborts = _canAct(person) and _game.outcome == OngoingPlay and _game.moves < 2
    _show(if (aborts) { ..._game, outcome: AbortedPlay } else _game, _offline)
  }

  /// Days pass for the game, whoever is connected. With one day left, the
  /// turn notice of the person to move comes back unread as a turn reminder.
  action multiplayerTimePasses(days: int): bool = _show(_tick(_game, days), _offline)

  /// Opening one's turn notice shows the daily game. The turn notice is no
  /// longer unread, and stays until the person's own move is accepted. With
  /// no connection it stays as it was.
  action openTurnNotice(person: str): bool =
    _show(if (_canAct(person) and _turnOf(_game) == person)
      { ..._game, opened: _game.opened.union(Set(person)) }
      else _game, _offline)

  /// Opening one's result notice shows how the daily game ended. It never
  /// dismisses the result notice, with or without a connection.
  action openResultNotice(person: str): bool = _show(_game, _offline)

  /// Dismissing one's result notice takes it out of one's own inbox only,
  /// and needs a connection.
  action dismissResultNotice(person: str): bool =
    _show(if (_canAct(person) and _over(_game.outcome))
      { ..._game, dismissed: _game.dismissed.union(Set(person)) }
      else _game, _offline)

  /// A device with no connection keeps what it last showed; the game and its
  /// clocks go on.
  action loseConnection(person: str): bool = all {
    not(_offline.contains(person)),
    _show(_game, _offline.union(Set(person))),
  }

  /// Back online, a person sees the game as it now stands and the turn
  /// notice or result notice that became theirs meanwhile.
  action comeBackOnline(person: str): bool = all {
    _offline.contains(person),
    _show(_game, _offline.exclude(Set(person))),
  }

  /// A person opens or dismisses only what their inbox shows.
  action step = {
    nondet person = PEOPLE.oneOf()
    nondet history = (if (_game.history >= 0) Set(_game.history) else HISTORIES).oneOf()
    nondet days = PASSING_DAYS.oneOf()
    val moving = PEOPLE.filter(p => _canAct(p) and _turnOf(_game) == p)
    nondet movePerson = moving.union(Set(person)).oneOf()
    nondet _rareEvent = 0.to(15).oneOf()
    any {
      matchFormed, playMove(movePerson, history),
      all { _rareEvent == 0, resignPlay(person) },
      all { _rareEvent == 0, abortPlay(person) },
      all { _rareEvent % 4 == 0, multiplayerTimePasses(days) },
      all { turnNotice.get(person) != "none", openTurnNotice(person) },
      all { resultNotice.get(person) != "none", openResultNotice(person) },
      all { resultNotice.get(person) != "none", dismissResultNotice(person) },
      loseConnection(person), comeBackOnline(person),
    }
  }

  /// Connected people see the same game as it stands: the board, both
  /// multiplayer clocks, the result and their own inbox.
  val invConnectedPeopleAgree = PEOPLE.forall(p => not(_offline.contains(p)) implies {
    val v = _view(_game, p)
    and {
      moveCount.get(p) == v.moveCount, turn.get(p) == v.turn, playOutcome.get(p) == v.playOutcome,
      whiteClock.get(p) == v.whiteClock, blackClock.get(p) == v.blackClock,
      turnNotice.get(p) == v.turnNotice, turnReminder.get(p) == v.turnReminder,
      resultNotice.get(p) == v.resultNotice,
    }
  })
  /// With no connection a person keeps the board, clocks and inbox their
  /// device last showed, and never sees a move before it was made.
  val invOfflineKeepsLastKnown = PEOPLE.forall(p => _offline.contains(p) implies {
    val v = _lastKnown.get(p)
    and {
      moveCount.get(p) <= _game.moves,
      moveCount.get(p) == v.moveCount, turn.get(p) == v.turn, playOutcome.get(p) == v.playOutcome,
      whiteClock.get(p) == v.whiteClock, blackClock.get(p) == v.blackClock,
      turnNotice.get(p) == v.turnNotice, turnReminder.get(p) == v.turnReminder,
      resultNotice.get(p) == v.resultNotice,
    }
  })
  /// A connected person has a turn notice exactly while it is their turn in
  /// the unfinished daily game.
  val invTurnNoticeOnOwnTurn = PEOPLE.forall(p => not(_offline.contains(p)) implies
    ((turnNotice.get(p) != "none") iff (playOutcome.get(p) == OngoingPlay and turn.get(p) == p)))
  /// Only one of the two people is to move, so connected people never have a
  /// turn notice each.
  val invOneTurnNotice =
    PEOPLE.filter(p => not(_offline.contains(p)) and turnNotice.get(p) != "none").size() <= 1
  /// A connected person's turn notice is a turn reminder exactly while it is
  /// their turn and their multiplayer clock is low on time, with one day or
  /// less left. It is never a second item: without a turn notice there is no
  /// turn reminder.
  val invTurnReminderWhenLowOnTime = PEOPLE.forall(p => not(_offline.contains(p)) implies {
    val sideLeft = if (moveCount.get(p) % 2 == 0) whiteClock.get(p) else blackClock.get(p)
    turnReminder.get(p) iff (turnNotice.get(p) != "none" and sideLeft <= REMINDER_DAYS)
  })
  /// A result notice tells a connected person how the daily game ended for
  /// them; there is none while the game is unfinished, and one stays until
  /// its person dismisses it.
  val invResultNoticeIsHonest = PEOPLE.forall(p => not(_offline.contains(p)) implies and {
    Set("none", "won", "lost", "drawn", "aborted").contains(resultNotice.get(p)),
    (resultNotice.get(p) == "won") implies (playOutcome.get(p) == WonPlay(p)),
    (resultNotice.get(p) == "lost") implies (playOutcome.get(p) == WonPlay(_other(p))),
    (resultNotice.get(p) == "drawn") implies (playOutcome.get(p) == DrawnPlay),
    (resultNotice.get(p) == "aborted") implies (playOutcome.get(p) == AbortedPlay),
    not(_over(playOutcome.get(p))) implies (resultNotice.get(p) == "none"),
    (_over(playOutcome.get(p)) and not(_game.dismissed.contains(p))) implies (resultNotice.get(p) != "none"),
  })
  /// The side that is not to move shows the full days; the side to move
  /// never holds more than them. Days that run out before both people have
  /// moved abort the game; afterwards they lose it.
  val invDailyClock = PEOPLE.forall(p => not(_offline.contains(p)) implies {
    val whiteToMove = moveCount.get(p) % 2 == 0
    val sideLeft = if (whiteToMove) whiteClock.get(p) else blackClock.get(p)
    val otherLeft = if (whiteToMove) blackClock.get(p) else whiteClock.get(p)
    if (playOutcome.get(p) == NoPlay) and { whiteClock.get(p) == 0, blackClock.get(p) == 0 }
    else and {
      otherLeft == DAYS_PER_MOVE, sideLeft >= 0, sideLeft <= DAYS_PER_MOVE,
      (playOutcome.get(p) == OngoingPlay) implies (sideLeft >= 1),
      (sideLeft == 0 and moveCount.get(p) < 2) implies (playOutcome.get(p) == AbortedPlay),
      (sideLeft == 0 and moveCount.get(p) >= 2) implies
        (playOutcome.get(p) == WonPlay(if (whiteToMove) BLACK else WHITE)),
    }
  })
  /// Only a game in which both people have not yet moved is aborted, and
  /// nobody wins or draws a game before both people have moved.
  val invHonestResult = and {
    (_game.outcome == AbortedPlay) implies (_game.moves < 2),
    (_game.outcome == WonPlay(WHITE) or _game.outcome == WonPlay(BLACK) or _game.outcome == DrawnPlay)
      implies (_game.moves >= 2),
  }
  /// Bookkeeping: the game is bounded here to eight accepted moves.
  val invAcceptedMoves = and {
    _game.moves >= 0, _game.moves <= MOST_MOVES,
    (_game.outcome == NoPlay) implies (_game.moves == 0),
  }
}
