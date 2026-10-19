// Pairing two people up gives them one private, rated matched game of the
// game at the clock choice both of them chose. The matched game owns the
// sides, moves, both clocks, draw offers, rematches and the result, never the
// pairing itself. Of two paired people, the one with the greater side balance
// gets the second side; equal balances allow either side. People cannot seek
// an opponent while their matched game is unfinished. Being told the same
// pairing again keeps the same matched game.
//
// Every matched game here is played in minutes and seconds; a daily game,
// which gives each person days for every move, is described on its own.
// Neither clock runs until both people have made their first move. The first
// side has 30 seconds from the start for it, and the second side 30 seconds
// from the first side's first move; missing it aborts the matched game.
// Either person may abort until both have moved, and resigning waits until
// then; confirming account deletion before then aborts the matched game too.
// After that only the side to move spends time, each move the game allows
// adds the clock choice's seconds to the person who made it, and running out
// of time loses. Every finished matched game counts once toward both people's
// rated games at its speed; an aborted one counts for nobody. A draw offer
// waits for the other person, and their move declines it. After a finished
// matched game either person may offer a rematch: a new matched game at the
// same clock choice with the sides swapped, without seeking an opponent
// again.
//
// Three people each have two devices. Two pairings, and a rematch of each,
// show competing devices, moves for an earlier board, old resignations and a
// pairing told twice. Four of the eleven clock choices written in minutes
// stand for the speeds bullet, blitz and rapid, and "4+0" for a clock choice
// that is not offered. Every matched game follows the game's known victory:
// seven moves, the seventh of which is the first side's winning move by the
// game's own rules. Along it both sides can still win, so running out of time
// here always loses. A victory of the second side by the game's rules, a draw
// by the game's rules and longer games follow the game's own rules; a matched
// game here is drawn only by agreement. Exact rating values follow the
// Glicko-2 system and its examples.
// An offline device keeps its last known board, clocks and search, and
// cannot move, resign, abort or make an offer. The clock of a person whose
// turn it is keeps running while they are away. Returning shows the accepted
// matched game and result.
module matched_game {
  import events.* from "../matchmaking/events"

  type PlayDevice = { person: str, place: str }
  type PlayOutcome = NoPlay | OngoingPlay | WonPlay(str) | DrawnPlay | AbortedPlay
  type PlayGame = {
    first: str, second: str, control: str, moves: int, outcome: PlayOutcome,
    firstLeft: int, secondLeft: int, firstMoveWait: int,
    drawBy: str, rematchBy: str, firstBalance: int, secondBalance: int
  }
  type LastKnownPlay = {
    playNumber: int, playSide: str, moveCount: int, turn: str, playOutcome: PlayOutcome,
    seeking: bool, seekingSeconds: int, clockChoice: str,
    firstSideClock: int, secondSideClock: int, drawOffer: str, rematchOffer: str,
    ratedGames: str -> int
  }
  type PlayWorld = {
    games: int -> PlayGame, received: Set[int],
    current: str -> int, seekingAt: str -> str, searchAge: str -> int,
    accounts: Set[str], offline: Set[PlayDevice], balance: str -> int,
    rated: str -> (str -> int)
  }

  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val DEVICES = PEOPLE.map(p => Set("phone", "computer").map(d => { person: p, place: d })).flatten()
  pure val MATCHES = Set(1, 2)
  pure val NUMBERS = Set(1, 2, 3, 4)
  /// The moves the game's known victory takes; the last one is the first side's winning move.
  pure val VICTORY_MOVES = 7
  pure val POSITIONS = 0.to(VICTORY_MOVES - 1)
  pure val SPEEDS = Set("bullet", "blitz", "rapid")
  pure val CLOCK_CHOICES = Map(
    "1+0" -> { seconds: 60, increment: 0, speed: "bullet" },
    "2+1" -> { seconds: 120, increment: 1, speed: "bullet" },
    "3+2" -> { seconds: 180, increment: 2, speed: "blitz" },
    "10+5" -> { seconds: 600, increment: 5, speed: "rapid" }
  )
  pure val ASKED_CHOICES = CLOCK_CHOICES.keys().union(Set("4+0"))
  pure val FIRST_MOVE_SECONDS = 30
  pure val PASSING_SECONDS = Set(1, 10, 29, 30, 60)
  pure val NOBODY = "nobody"
  pure val NONE = "none"
  pure val NO_RATINGS = SPEEDS.mapBy(_ => 0)
  pure val NO_GAME = {
    first: NOBODY, second: NOBODY, control: NONE, moves: 0, outcome: NoPlay,
    firstLeft: 0, secondLeft: 0, firstMoveWait: 0,
    drawBy: NOBODY, rematchBy: NOBODY, firstBalance: 0, secondBalance: 0
  }
  pure val FIRST_VIEW = {
    playNumber: 0, playSide: NONE, moveCount: 0, turn: NOBODY, playOutcome: NoPlay,
    seeking: false, seekingSeconds: 0, clockChoice: NONE,
    firstSideClock: 0, secondSideClock: 0, drawOffer: NOBODY, rematchOffer: NOBODY,
    ratedGames: NO_RATINGS
  }

  /// The person's current or most recent matched game, or none yet.
  var playNumber: PlayDevice -> int
  /// The side this person has in that matched game: "first", "second" or "none".
  var playSide: PlayDevice -> str
  /// How many accepted moves are shown on this device's board.
  var moveCount: PlayDevice -> int
  /// Who may move next, or nobody once the matched game is over.
  var turn: PlayDevice -> str
  /// The result, that play is unfinished, or that it was aborted.
  var playOutcome: PlayDevice -> PlayOutcome
  /// Whether this person is seeking an opponent.
  var seeking: PlayDevice -> bool
  /// How many seconds the current search has been seeking.
  var seekingSeconds: PlayDevice -> int
  /// The clock choice of the current search, or else of the matched game shown.
  var clockChoice: PlayDevice -> str
  /// Seconds left on the first side's and on the second side's clock.
  var firstSideClock: PlayDevice -> int
  var secondSideClock: PlayDevice -> int
  /// Who is offering a draw in the matched game shown, or nobody.
  var drawOffer: PlayDevice -> str
  /// Who is offering a rematch of the matched game shown, or nobody.
  var rematchOffer: PlayDevice -> str
  /// How many rated matched games this person has played at each speed.
  var ratedGames: PlayDevice -> (str -> int)

  var _games: int -> PlayGame
  var _received: Set[int]
  var _current: str -> int
  var _seeking: str -> str
  var _searchAge: str -> int
  var _accounts: Set[str]
  var _offline: Set[PlayDevice]
  var _balance: str -> int
  var _rated: str -> (str -> int)
  var _lastKnown: PlayDevice -> LastKnownPlay

  val _now: PlayWorld = {
    games: _games, received: _received, current: _current,
    seekingAt: _seeking, searchAge: _searchAge, accounts: _accounts, offline: _offline,
    balance: _balance, rated: _rated
  }

  pure def _seconds(c: str): int = if (CLOCK_CHOICES.keys().contains(c)) CLOCK_CHOICES.get(c).seconds else 0
  pure def _increment(c: str): int = if (CLOCK_CHOICES.keys().contains(c)) CLOCK_CHOICES.get(c).increment else 0
  pure def _speed(c: str): str = if (CLOCK_CHOICES.keys().contains(c)) CLOCK_CHOICES.get(c).speed else NONE
  pure def _turn(g: PlayGame): str =
    if (g.outcome != OngoingPlay) NOBODY else if (g.moves % 2 == 0) g.first else g.second
  pure def _other(g: PlayGame, p: str): str = if (g.first == p) g.second else g.first
  pure def _plays(g: PlayGame, p: str): bool = g.first == p or g.second == p
  pure def _finished(o: PlayOutcome): bool = o != NoPlay and o != OngoingPlay and o != AbortedPlay

  pure def _unfinishedGames(games: int -> PlayGame, p: str): int = NUMBERS.fold(0, (count, n) => {
    val g = games.get(n)
    if (g.outcome == OngoingPlay and _plays(g, p)) count + 1 else count
  })
  pure def _finishedBalance(games: int -> PlayGame, p: str): int = NUMBERS.fold(0, (balance, n) => {
    val g = games.get(n)
    balance + (if (_finished(g.outcome) and g.first == p) 1 else 0)
      - (if (_finished(g.outcome) and g.second == p) 1 else 0)
  })
  pure def _finishedRated(games: int -> PlayGame, p: str, sp: str): int = NUMBERS.fold(0, (count, n) => {
    val g = games.get(n)
    if (_finished(g.outcome) and _plays(g, p) and _speed(g.control) == sp) count + 1 else count
  })

  def _game(p: str): PlayGame = _games.get(_current.get(p))
  def _unfinished(p: str): bool = _current.get(p) != 0 and _game(p).outcome == OngoingPlay
  def _canAct(d: PlayDevice): bool = not(_offline.contains(d)) and _accounts.contains(d.person)

  /// What one person sees on an online device.
  pure def _view(w: PlayWorld, p: str): LastKnownPlay = {
    val n = w.current.get(p)
    val g = w.games.get(n)
    val looking = w.seekingAt.get(p) != NONE
    {
      playNumber: n,
      playSide: if (g.first == p) "first" else if (g.second == p) "second" else NONE,
      moveCount: g.moves, turn: _turn(g), playOutcome: g.outcome,
      seeking: looking,
      seekingSeconds: if (looking) w.searchAge.get(p) else 0,
      clockChoice: if (looking) w.seekingAt.get(p) else g.control,
      firstSideClock: g.firstLeft, secondSideClock: g.secondLeft,
      drawOffer: g.drawBy, rematchOffer: g.rematchBy,
      ratedGames: w.rated.get(p)
    }
  }

  /// Records a matched game's new state. One that just finished counts once
  /// toward both people's rated games at its speed and their side balance.
  pure def _record(w: PlayWorld, n: int, changed: PlayGame): PlayWorld = {
    val before = w.games.get(n)
    val settled = if (changed.outcome == OngoingPlay) changed else { ...changed, drawBy: NOBODY }
    val games = w.games.set(n, settled)
    if (before.outcome == OngoingPlay and _finished(settled.outcome)) {
      val sp = _speed(settled.control)
      { ...w,
        games: games,
        rated: w.rated
          .setBy(settled.first, r => r.setBy(sp, c => c + 1))
          .setBy(settled.second, r => r.setBy(sp, c => c + 1)),
        balance: w.balance.setBy(settled.first, b => b + 1).setBy(settled.second, b => b - 1) }
    } else { ...w, games: games }
  }

  /// Starts a search at a clock choice, ending any rematch offer of the
  /// person's last matched game.
  pure def _search(w: PlayWorld, p: str, control: str): PlayWorld = {
    val n = w.current.get(p)
    { ...w,
      seekingAt: w.seekingAt.set(p, control), searchAge: w.searchAge.set(p, 0),
      games: w.games.set(n, { ...w.games.get(n), rematchBy: NOBODY }) }
  }

  /// A rematch of a finished matched game: same people and clock choice,
  /// sides swapped, numbered two after the earlier game.
  pure def _rematch(w: PlayWorld, number: int): PlayWorld = {
    val g = w.games.get(number)
    val n = number + 2
    { ...w,
      games: w.games.set(number, { ...g, rematchBy: NOBODY }).set(n, { ...NO_GAME,
        first: g.second, second: g.first, control: g.control, outcome: OngoingPlay,
        firstLeft: _seconds(g.control), secondLeft: _seconds(g.control),
        firstBalance: w.balance.get(g.second), secondBalance: w.balance.get(g.first) }),
      current: w.current.set(g.first, n).set(g.second, n) }
  }

  /// Seconds passing in one matched game: a missed first move aborts it, and
  /// a clock reaching zero loses for the side to move.
  pure def _tick(g: PlayGame, s: int): PlayGame =
    if (g.outcome != OngoingPlay) g
    else if (g.moves < 2) {
      if (g.firstMoveWait + s >= FIRST_MOVE_SECONDS)
        { ...g, firstMoveWait: FIRST_MOVE_SECONDS, outcome: AbortedPlay }
      else { ...g, firstMoveWait: g.firstMoveWait + s }
    }
    else if (g.moves % 2 == 0) {
      if (g.firstLeft <= s) { ...g, firstLeft: 0, outcome: WonPlay(g.second) }
      else { ...g, firstLeft: g.firstLeft - s }
    }
    else {
      if (g.secondLeft <= s) { ...g, secondLeft: 0, outcome: WonPlay(g.first) }
      else { ...g, secondLeft: g.secondLeft - s }
    }

  action _show(w: PlayWorld): bool = {
    val shown = DEVICES.mapBy(d => if (w.offline.contains(d)) _lastKnown.get(d) else _view(w, d.person))
    all {
      _games' = w.games, _received' = w.received,
      _current' = w.current, _seeking' = w.seekingAt, _searchAge' = w.searchAge,
      _accounts' = w.accounts, _offline' = w.offline, _balance' = w.balance, _rated' = w.rated,
      _lastKnown' = shown,
      playNumber' = DEVICES.mapBy(d => shown.get(d).playNumber),
      playSide' = DEVICES.mapBy(d => shown.get(d).playSide),
      moveCount' = DEVICES.mapBy(d => shown.get(d).moveCount),
      turn' = DEVICES.mapBy(d => shown.get(d).turn),
      playOutcome' = DEVICES.mapBy(d => shown.get(d).playOutcome),
      seeking' = DEVICES.mapBy(d => shown.get(d).seeking),
      seekingSeconds' = DEVICES.mapBy(d => shown.get(d).seekingSeconds),
      clockChoice' = DEVICES.mapBy(d => shown.get(d).clockChoice),
      firstSideClock' = DEVICES.mapBy(d => shown.get(d).firstSideClock),
      secondSideClock' = DEVICES.mapBy(d => shown.get(d).secondSideClock),
      drawOffer' = DEVICES.mapBy(d => shown.get(d).drawOffer),
      rematchOffer' = DEVICES.mapBy(d => shown.get(d).rematchOffer),
      ratedGames' = DEVICES.mapBy(d => shown.get(d).ratedGames),
    }
  }

  action init = all {
    _games' = 0.to(4).mapBy(_ => NO_GAME),
    _received' = Set(), _current' = PEOPLE.mapBy(_ => 0),
    _seeking' = PEOPLE.mapBy(_ => NONE), _searchAge' = PEOPLE.mapBy(_ => 0),
    _accounts' = PEOPLE, _offline' = Set(),
    _balance' = PEOPLE.mapBy(_ => 0), _rated' = PEOPLE.mapBy(_ => NO_RATINGS),
    _lastKnown' = DEVICES.mapBy(_ => FIRST_VIEW),
    playNumber' = DEVICES.mapBy(_ => 0), playSide' = DEVICES.mapBy(_ => NONE),
    moveCount' = DEVICES.mapBy(_ => 0), turn' = DEVICES.mapBy(_ => NOBODY),
    playOutcome' = DEVICES.mapBy(_ => NoPlay),
    seeking' = DEVICES.mapBy(_ => false), seekingSeconds' = DEVICES.mapBy(_ => 0),
    clockChoice' = DEVICES.mapBy(_ => NONE),
    firstSideClock' = DEVICES.mapBy(_ => 0), secondSideClock' = DEVICES.mapBy(_ => 0),
    drawOffer' = DEVICES.mapBy(_ => NOBODY), rematchOffer' = DEVICES.mapBy(_ => NOBODY),
    ratedGames' = DEVICES.mapBy(_ => NO_RATINGS),
  }

  /// Opening one's own finding an opponent never creates or changes a matched game.
  action openFindingAnOpponent(device: PlayDevice): bool = _show(_now)

  /// Seeking an opponent needs an account, a connection, an offered clock
  /// choice and no unfinished matched game.
  action seekOpponent(device: PlayDevice, control: str): bool = {
    val p = device.person
    val canAsk = and {
      _canAct(device), not(_unfinished(p)), _seeking.get(p) == NONE,
      CLOCK_CHOICES.keys().contains(control),
    }
    _show(if (canAsk) _search(_now, p, control) else _now)
  }

  /// From a matched game that is over or aborted, seek again at its clock choice.
  action findNewOpponent(device: PlayDevice): bool = {
    val p = device.person
    val g = _game(p)
    val canAsk = and {
      _canAct(device), _current.get(p) != 0, g.outcome != OngoingPlay, _seeking.get(p) == NONE,
    }
    _show(if (canAsk) _search(_now, p, g.control) else _now)
  }

  /// Stopping the search cannot stop an already formed matched game.
  action stopSeeking(device: PlayDevice): bool =
    _show(if (_offline.contains(device)) _now
      else { ..._now, seekingAt: _seeking.set(device.person, NONE), searchAge: _searchAge.set(device.person, 0) })

  /// Matchmaking has already paired two people seeking at the same clock
  /// choice; the one with the greater side balance gets the second side. A
  /// pairing told again keeps its matched game.
  action pairPeopleUp(number: int, first: str, second: str): bool = {
    val fact = MatchFormed({ matchmakingMatch: if (number == 1) "first" else "second", people: Set(first, second) })
    val control = _seeking.get(first)
    val repeated = _received.contains(number) and _games.get(number).first == first and _games.get(number).second == second
    val fresh = and {
      not(_received.contains(number)), MATCHES.contains(number), first != second,
      _accounts.contains(first), _accounts.contains(second),
      control != NONE, _seeking.get(second) == control,
      not(_unfinished(first)), not(_unfinished(second)),
      _balance.get(first) <= _balance.get(second),
    }
    all {
      fresh or repeated,
      if (repeated) _show(_now)
      else _show({ ..._now,
        games: _games.set(number, { ...NO_GAME,
          first: first, second: second, control: control, outcome: OngoingPlay,
          firstLeft: _seconds(control), secondLeft: _seconds(control),
          firstBalance: _balance.get(first), secondBalance: _balance.get(second) }),
        received: _received.union(Set(number)),
        current: _current.set(first, number).set(second, number),
        seekingAt: _seeking.set(first, NONE).set(second, NONE),
        searchAge: _searchAge.set(first, 0).set(second, 0) }),
    }
  }

  /// The victory's next move, for this exact matched game and board, counts
  /// once, on one's turn; a move the game refuses changes nothing. Its
  /// seventh move is the first side's winning move. Once both people have
  /// moved it adds the clock choice's seconds to the mover. A move by the
  /// person offered a draw declines it; the offering person's keeps it.
  action playMove(device: PlayDevice, number: int, position: int, legal: bool): bool = {
    val g = _games.get(number)
    val p = device.person
    val counts = and {
      _canAct(device), _current.get(p) == number, g.outcome == OngoingPlay,
      _turn(g) == p, position == g.moves, legal,
    }
    val outcome = if (g.moves == VICTORY_MOVES - 1) WonPlay(g.first) else OngoingPlay
    val bonus = if (g.moves >= 2) _increment(g.control) else 0
    val moved = { ...g,
      moves: g.moves + 1, outcome: outcome, firstMoveWait: 0,
      firstLeft: if (g.moves % 2 == 0) g.firstLeft + bonus else g.firstLeft,
      secondLeft: if (g.moves % 2 == 1) g.secondLeft + bonus else g.secondLeft,
      drawBy: if (g.drawBy == p) p else NOBODY }
    _show(if (counts) _record(_now, number, moved) else _now)
  }

  /// The next move of the matched game a device shows, played for its board.
  action playCurrentMove(device: PlayDevice): bool =
    playMove(device, _current.get(device.person), moveCount.get(device), true)

  /// Once both people have made their first move, either person can resign
  /// this unfinished matched game; before that they abort instead. Old
  /// resignations stay old.
  action resignGame(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val resigns = and {
      _canAct(device), _current.get(device.person) == number, g.outcome == OngoingPlay, g.moves >= 2,
    }
    _show(if (resigns) _record(_now, number, { ...g, outcome: WonPlay(_other(g, device.person)) }) else _now)
  }

  /// Either person may abort until both have made their first move. An
  /// aborted matched game has no winner and counts for nobody.
  action abortGame(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val aborts = and {
      _canAct(device), _current.get(device.person) == number, g.outcome == OngoingPlay, g.moves < 2,
    }
    _show(if (aborts) _record(_now, number, { ...g, outcome: AbortedPlay }) else _now)
  }

  /// Either person may offer a draw in an unfinished matched game; offering
  /// back accepts the other person's draw offer.
  action offerDraw(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val offers = _canAct(device) and _current.get(p) == number and g.outcome == OngoingPlay
    _show(if (not(offers)) _now
      else if (g.drawBy == _other(g, p)) _record(_now, number, { ...g, outcome: DrawnPlay })
      else _record(_now, number, { ...g, drawBy: p }))
  }

  /// Only the person offered a draw can accept it: drawn by agreement.
  action acceptDraw(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val accepts = and {
      _canAct(device), _current.get(p) == number, g.outcome == OngoingPlay, g.drawBy == _other(g, p),
    }
    _show(if (accepts) _record(_now, number, { ...g, outcome: DrawnPlay }) else _now)
  }

  /// Only the person offered a draw can decline it; the matched game goes on.
  action declineDraw(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val declines = and {
      _canAct(device), _current.get(p) == number, g.outcome == OngoingPlay, g.drawBy == _other(g, p),
    }
    _show(if (declines) _record(_now, number, { ...g, drawBy: NOBODY }) else _now)
  }

  /// A rematch needs a finished matched game that both people still have as
  /// their latest, with neither of them seeking an opponent.
  def _rematchable(p: str, number: int): bool = {
    val g = _games.get(number)
    val q = _other(g, p)
    and {
      _current.get(p) == number, _plays(g, p), _finished(g.outcome),
      _accounts.contains(q), _current.get(q) == number,
      _seeking.get(p) == NONE, _seeking.get(q) == NONE,
    }
  }

  /// After a finished matched game either person may offer a rematch;
  /// offering back accepts. Bounded here to one rematch of each pairing.
  action offerRematch(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val offers = _canAct(device) and _rematchable(p, number)
    val accepts = offers and g.rematchBy == _other(g, p)
    all {
      not(accepts) or MATCHES.contains(number),
      _show(if (accepts) _rematch(_now, number)
        else if (offers) { ..._now, games: _games.set(number, { ...g, rematchBy: p }) }
        else _now),
    }
  }

  /// Only the person offered a rematch can accept it; the new matched game starts at once.
  action acceptRematch(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val accepts = _canAct(device) and _rematchable(p, number) and g.rematchBy == _other(g, p)
    all {
      not(accepts) or MATCHES.contains(number),
      _show(if (accepts) _rematch(_now, number) else _now),
    }
  }

  /// Only the person offered a rematch can decline it; the offer ends.
  action declineRematch(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val declines = _canAct(device) and _rematchable(p, number) and g.rematchBy == _other(g, p)
    _show(if (declines) { ..._now, games: _games.set(number, { ...g, rematchBy: NOBODY }) } else _now)
  }

  /// Confirmed account deletion stops seeking, aborts a matched game in
  /// which both people have not yet moved, gives up other unfinished play
  /// and ends any rematch offer.
  action deleteAccount(person: str): bool = {
    val n = _current.get(person)
    val g = _games.get(n)
    val given = if (_unfinished(person) and g.moves < 2) _record(_now, n, { ...g, outcome: AbortedPlay })
      else if (_unfinished(person)) _record(_now, n, { ...g, outcome: WonPlay(_other(g, person)) })
      else { ..._now, games: _games.set(n, { ...g, rematchBy: NOBODY }) }
    _show({ ...given,
      current: _current.set(person, 0), seekingAt: _seeking.set(person, NONE),
      searchAge: _searchAge.set(person, 0), accounts: _accounts.exclude(Set(person)) })
  }

  /// Seconds pass for every matched game and search, whoever is online.
  action secondsPass(seconds: int): bool = {
    val clocksStopped = NUMBERS.forall(n => _games.get(n).outcome != OngoingPlay)
    val ticked = if (clocksStopped) _now
      else NUMBERS.fold(_now, (w, n) => _record(w, n, _tick(w.games.get(n), seconds)))
    _show({ ...ticked,
      searchAge: PEOPLE.mapBy(p => if (_seeking.get(p) != NONE) _searchAge.get(p) + seconds else _searchAge.get(p)) })
  }

  /// An offline device keeps its last known board; the matched game and clocks go on.
  action loseConnection(device: PlayDevice): bool = all {
    not(_offline.contains(device)),
    _show({ ..._now, offline: _offline.union(Set(device)) }),
  }

  /// Returning shows accepted moves, clocks and the result, without a new command.
  action comeBackOnline(device: PlayDevice): bool = all {
    _offline.contains(device),
    _show({ ..._now, offline: _offline.exclude(Set(device)) }),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet person = PEOPLE.oneOf()
    nondet anyNumber = NUMBERS.oneOf()
    nondet number = Set(anyNumber, _current.get(device.person)).oneOf()
    nondet askedControl = ASKED_CHOICES.oneOf()
    nondet control = PEOPLE.map(p => _seeking.get(p)).exclude(Set(NONE)).union(Set(askedControl)).oneOf()
    nondet seconds = PASSING_SECONDS.oneOf()
    val moving = DEVICES.filter(d => not(_offline.contains(d)) and _unfinished(d.person) and _turn(_game(d.person)) == d.person)
    nondet moveDevice = moving.union(Set(device)).oneOf()
    nondet moveNumber = Set(anyNumber, _current.get(moveDevice.person)).oneOf()
    nondet earlierPosition = POSITIONS.oneOf()
    nondet position = Set(moveCount.get(moveDevice), earlierPosition).oneOf()
    nondet _rareEvent = 0.to(127).oneOf()
    nondet legal = Set(true, false).oneOf()
    val offered = DEVICES.filter(d => {
      val g = _game(d.person)
      (g.drawBy != NOBODY and g.drawBy != d.person) or (g.rematchBy != NOBODY and g.rematchBy != d.person)
    })
    nondet answerDevice = offered.union(Set(device)).oneOf()
    nondet answerNumber = Set(number, _current.get(answerDevice.person)).oneOf()
    nondet matchNumber = MATCHES.oneOf()
    val seekers = PEOPLE.filter(p => _seeking.get(p) != NONE)
    nondet first = (if (_received.contains(matchNumber)) Set(_games.get(matchNumber).first)
      else if (seekers == Set()) PEOPLE else seekers).oneOf()
    val partners = seekers.filter(p => p != first and _seeking.get(p) == _seeking.get(first))
    nondet second = (if (_received.contains(matchNumber)) Set(_games.get(matchNumber).second)
      else if (partners == Set()) PEOPLE.exclude(Set(first)) else partners).oneOf()
    val firstSide = if (_received.contains(matchNumber) or _balance.get(first) <= _balance.get(second)) first else second
    val secondSide = if (firstSide == first) second else first
    any {
      openFindingAnOpponent(device), seekOpponent(device, control), findNewOpponent(device),
      stopSeeking(device), pairPeopleUp(matchNumber, firstSide, secondSide),
      playMove(moveDevice, moveNumber, position, legal),
      playCurrentMove(moveDevice),
      all { _rareEvent == 0, resignGame(device, number) },
      all { _rareEvent == 0, deleteAccount(person) },
      all { _rareEvent % 8 == 0, abortGame(device, number) },
      all { _rareEvent % 4 == 0, offerDraw(device, number) },
      acceptDraw(answerDevice, answerNumber), declineDraw(answerDevice, answerNumber),
      offerRematch(device, number),
      acceptRematch(answerDevice, answerNumber), declineRematch(answerDevice, answerNumber),
      all { _rareEvent % 8 == 0, secondsPass(seconds) },
      loseConnection(device), comeBackOnline(device),
    }
  }

  /// Every matched game has two distinct people and fixed sides.
  val invDistinctSides = NUMBERS.forall(n => _games.get(n).outcome != NoPlay implies and {
    _games.get(n).first != _games.get(n).second,
    PEOPLE.contains(_games.get(n).first), PEOPLE.contains(_games.get(n).second),
  })
  /// One person cannot have two unfinished matched games or seek an opponent during one.
  val invOneUnfinishedGame = PEOPLE.forall(p => and {
    _unfinishedGames(_games, p) <= 1,
    _unfinished(p) implies _seeking.get(p) == NONE,
  })
  /// A winner is one of the two people, nobody moves once a matched game is
  /// over, only a matched game in which both people have not yet moved is
  /// aborted, and nobody wins one before both people have moved.
  val invHonestResult = NUMBERS.forall(n => {
    val g = _games.get(n)
    and {
      g.outcome == NoPlay or g.outcome == OngoingPlay or g.outcome == DrawnPlay or
        g.outcome == AbortedPlay or g.outcome == WonPlay(g.first) or g.outcome == WonPlay(g.second),
      g.outcome != OngoingPlay implies _turn(g) == NOBODY,
      g.outcome == AbortedPlay implies g.moves < 2,
      (g.outcome == WonPlay(g.first) or g.outcome == WonPlay(g.second)) implies g.moves >= 2,
    }
  })
  /// Every person seeking an opponent chooses an offered clock choice.
  val invSearchClockChoice = PEOPLE.forall(p =>
    _seeking.get(p) == NONE or CLOCK_CHOICES.keys().contains(_seeking.get(p)))
  /// Every matched game has an offered clock choice.
  val invGameClockChoice = NUMBERS.forall(n =>
    _games.get(n).outcome != NoPlay implies CLOCK_CHOICES.keys().contains(_games.get(n).control))
  /// A rematch follows a finished matched game with the same clock choice
  /// and the sides swapped.
  val invRematchClockChoice = MATCHES.forall(n => _games.get(n + 2).outcome != NoPlay implies and {
    _games.get(n + 2).first == _games.get(n).second,
    _games.get(n + 2).second == _games.get(n).first,
    _games.get(n + 2).control == _games.get(n).control,
    _finished(_games.get(n).outcome),
  })
  /// Of two paired people, the one with the greater side balance gets the
  /// second side; a side balance counts finished matched games only.
  val invFairSides = and {
    MATCHES.forall(n => _games.get(n).outcome != NoPlay implies
      _games.get(n).firstBalance <= _games.get(n).secondBalance),
    PEOPLE.forall(p => _balance.get(p) == _finishedBalance(_games, p)),
  }
  /// Neither clock runs before both first moves, a clock never holds more
  /// than its time plus the seconds earned, and a clock at zero lost.
  val invClocks = NUMBERS.forall(n => {
    val g = _games.get(n)
    g.outcome != NoPlay implies and {
      g.moves < 2 implies and { g.firstLeft == _seconds(g.control), g.secondLeft == _seconds(g.control) },
      g.firstLeft >= 0, g.secondLeft >= 0,
      g.firstLeft <= _seconds(g.control) + g.moves * _increment(g.control),
      g.secondLeft <= _seconds(g.control) + g.moves * _increment(g.control),
      g.firstLeft == 0 implies g.outcome == WonPlay(g.second),
      g.secondLeft == 0 implies g.outcome == WonPlay(g.first),
      g.outcome == OngoingPlay implies g.firstMoveWait < FIRST_MOVE_SECONDS,
    }
  })
  /// Each finished matched game counts once toward both people's rated games
  /// at its speed; an aborted one counts for nobody.
  val invRatedOnce = PEOPLE.forall(p => SPEEDS.forall(sp =>
    _rated.get(p).get(sp) == _finishedRated(_games, p, sp)))
  /// A draw offer belongs to one of the two people of an unfinished matched
  /// game; a rematch offer to one of the two people of a finished one both
  /// still have.
  val invOffers = NUMBERS.forall(n => {
    val g = _games.get(n)
    and {
      g.drawBy != NOBODY implies and { g.outcome == OngoingPlay, _plays(g, g.drawBy) },
      g.rematchBy != NOBODY implies and {
        _finished(g.outcome), _plays(g, g.rematchBy),
        _current.get(g.first) == n, _current.get(g.second) == n,
      },
    }
  })
  /// Online devices show the same accepted matched game, side, board,
  /// clocks, offers, search, result and rated games.
  val invDevicesAgree = DEVICES.forall(d => not(_offline.contains(d)) implies {
    val v = _view(_now, d.person)
    and {
      playNumber.get(d) == v.playNumber, playSide.get(d) == v.playSide,
      moveCount.get(d) == v.moveCount, turn.get(d) == v.turn, playOutcome.get(d) == v.playOutcome,
      seeking.get(d) == v.seeking, seekingSeconds.get(d) == v.seekingSeconds,
      clockChoice.get(d) == v.clockChoice,
      firstSideClock.get(d) == v.firstSideClock, secondSideClock.get(d) == v.secondSideClock,
      drawOffer.get(d) == v.drawOffer, rematchOffer.get(d) == v.rematchOffer,
      ratedGames.get(d) == v.ratedGames,
    }
  })
  /// Offline devices keep their last known board, clocks, offers and search
  /// until returning.
  val invOfflineBoard = DEVICES.forall(d => _offline.contains(d) implies {
    val v = _lastKnown.get(d)
    and {
      playNumber.get(d) == v.playNumber, playSide.get(d) == v.playSide,
      moveCount.get(d) == v.moveCount, turn.get(d) == v.turn, playOutcome.get(d) == v.playOutcome,
      seeking.get(d) == v.seeking, seekingSeconds.get(d) == v.seekingSeconds,
      clockChoice.get(d) == v.clockChoice,
      firstSideClock.get(d) == v.firstSideClock, secondSideClock.get(d) == v.secondSideClock,
      drawOffer.get(d) == v.drawOffer, rematchOffer.get(d) == v.rematchOffer,
      ratedGames.get(d) == v.ratedGames,
    }
  })
  /// Deleted accounts never keep seeking or reach a private matched game on return.
  val invDeletedCannotPlay = PEOPLE.forall(p => not(_accounts.contains(p)) implies and {
    _seeking.get(p) == NONE, _current.get(p) == 0, not(_unfinished(p)),
  })
  /// Bookkeeping: a matched game never has fewer than zero accepted moves.
  val invNonnegativeMoveCount = NUMBERS.forall(n => _games.get(n).moves >= 0)
  /// Bookkeeping: a matched game is bounded here by the victory's seven moves.
  val invMoveCountLimit = NUMBERS.forall(n => _games.get(n).moves <= VICTORY_MOVES)
  /// Bookkeeping: a matched game not yet played has no accepted moves.
  val invUnplayedMoveCount = NUMBERS.forall(n =>
    _games.get(n).outcome == NoPlay implies _games.get(n).moves == 0)
}
