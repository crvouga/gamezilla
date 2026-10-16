// A matchmaking match gives its two people one private, rated multiplayer
// game at the time control both of them chose. The game owns the colours,
// moves, both multiplayer clocks, draw offers, rematches and the result,
// never the pairing itself. Of two matched people, the one with the greater
// colour balance plays Black; equal balances allow either colour. People
// cannot look for an opponent while their game is unfinished. Being told
// the same match again keeps the same game.
//
// Every game here is played in minutes and seconds; a daily game, which
// gives each person days for every move, is described on its own. Neither
// multiplayer clock runs until both people have made their first
// move. White has 30 seconds from the start for it, and Black 30 seconds from
// White's first move; missing it aborts the game. Either person may abort
// until both have moved, and resigning waits until then; confirming account
// deletion before then aborts the game too. After that only the side to move
// spends time, each legal move adds the increment to the person who made it,
// and running out of time loses. Every finished game counts once toward both
// people's rated multiplayer games at its speed; an aborted game counts for
// nobody. A draw offer waits for the other person, and their move declines
// it. After a finished game either person may offer a rematch: a new game at
// the same time control with colours swapped, without a new search.
//
// Three people each have two devices. Two matchmaking matches, and a rematch
// of each, show competing devices, moves for an earlier board, old
// resignations and a match told twice. Four of the eleven time controls
// written in minutes stand
// for the speeds bullet, blitz and rapid, and "4+0" for a time control that
// is not offered. The move histories are an ordinary opening, Fool's Mate and
// two repetitions of both knights returning home; each leaves both sides able
// to checkmate, so running out of time here always loses. Other chess moves,
// endings and exact rating values follow the chess rules, the Glicko-2 system
// and their examples.
// An offline device keeps its last known board, clocks and search, and
// cannot move, resign, abort or make an offer. The clock of a person whose
// turn it is keeps running while they are away. Returning shows the accepted
// game and result.
module multiplayer {
  import events.* from "../matchmaking/events"

  type PlayDevice = { person: str, place: str }
  type PlayOutcome = NoPlay | OngoingPlay | WonPlay(str) | DrawnPlay | AbortedPlay
  type PlayGame = {
    white: str, black: str, control: str, moves: int, outcome: PlayOutcome,
    whiteLeft: int, blackLeft: int, firstMoveWait: int,
    drawBy: str, rematchBy: str, whiteBalance: int, blackBalance: int
  }
  type LastKnownPlay = {
    playNumber: int, playSide: str, moveCount: int, turn: str, playOutcome: PlayOutcome,
    lookingForOpponent: bool, lookingSeconds: int, timeControl: str,
    whiteClock: int, blackClock: int, drawOffer: str, rematchOffer: str,
    ratedGames: str -> int
  }
  type PlayWorld = {
    games: int -> PlayGame, sequence: int -> int, received: Set[int],
    current: str -> int, seeking: str -> str, searchAge: str -> int,
    accounts: Set[str], offline: Set[PlayDevice], balance: str -> int,
    rated: str -> (str -> int)
  }

  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val DEVICES = PEOPLE.map(p => Set("phone", "computer").map(d => { person: p, place: d })).flatten()
  pure val MATCHES = Set(1, 2)
  pure val NUMBERS = Set(1, 2, 3, 4)
  pure val POSITIONS = Set(0, 1, 2, 3, 4, 5, 6, 7)
  pure val SPEEDS = Set("bullet", "blitz", "rapid")
  pure val TIME_CONTROLS = Map(
    "1+0" -> { seconds: 60, increment: 0, speed: "bullet" },
    "2+1" -> { seconds: 120, increment: 1, speed: "bullet" },
    "3+2" -> { seconds: 180, increment: 2, speed: "blitz" },
    "10+5" -> { seconds: 600, increment: 5, speed: "rapid" }
  )
  pure val ASKED_CONTROLS = TIME_CONTROLS.keys().union(Set("4+0"))
  pure val FIRST_MOVE_SECONDS = 30
  pure val PASSING_SECONDS = Set(1, 10, 29, 30, 60)
  pure val NOBODY = "nobody"
  pure val NONE = "none"
  pure val NO_RATINGS = SPEEDS.mapBy(_ => 0)
  pure val NO_GAME = {
    white: NOBODY, black: NOBODY, control: NONE, moves: 0, outcome: NoPlay,
    whiteLeft: 0, blackLeft: 0, firstMoveWait: 0,
    drawBy: NOBODY, rematchBy: NOBODY, whiteBalance: 0, blackBalance: 0
  }
  pure val FIRST_VIEW = {
    playNumber: 0, playSide: NONE, moveCount: 0, turn: NOBODY, playOutcome: NoPlay,
    lookingForOpponent: false, lookingSeconds: 0, timeControl: NONE,
    whiteClock: 0, blackClock: 0, drawOffer: NOBODY, rematchOffer: NOBODY,
    ratedGames: NO_RATINGS
  }

  /// The person's current or most recent multiplayer game, or none yet.
  var playNumber: PlayDevice -> int
  /// The colour this person plays in that game: "White", "Black" or "none".
  var playSide: PlayDevice -> str
  /// How many accepted moves are shown on this device's multiplayer board.
  var moveCount: PlayDevice -> int
  /// Who may move next, or nobody once the game is over.
  var turn: PlayDevice -> str
  /// The multiplayer result, that play is unfinished, or that it was aborted.
  var playOutcome: PlayDevice -> PlayOutcome
  /// Whether this person is looking for a chess opponent.
  var lookingForOpponent: PlayDevice -> bool
  /// How many seconds the current search has been looking.
  var lookingSeconds: PlayDevice -> int
  /// The time control of the current search, or else of the game shown.
  var timeControl: PlayDevice -> str
  /// Seconds left on White's and on Black's multiplayer clock.
  var whiteClock: PlayDevice -> int
  var blackClock: PlayDevice -> int
  /// Who is offering a multiplayer draw in the game shown, or nobody.
  var drawOffer: PlayDevice -> str
  /// Who is offering a multiplayer rematch of the game shown, or nobody.
  var rematchOffer: PlayDevice -> str
  /// How many rated multiplayer games this person has played at each speed.
  var ratedGames: PlayDevice -> (str -> int)

  var _games: int -> PlayGame
  var _sequence: int -> int
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
    games: _games, sequence: _sequence, received: _received, current: _current,
    seeking: _seeking, searchAge: _searchAge, accounts: _accounts, offline: _offline,
    balance: _balance, rated: _rated
  }

  pure def _seconds(c: str): int = if (TIME_CONTROLS.keys().contains(c)) TIME_CONTROLS.get(c).seconds else 0
  pure def _increment(c: str): int = if (TIME_CONTROLS.keys().contains(c)) TIME_CONTROLS.get(c).increment else 0
  pure def _speed(c: str): str = if (TIME_CONTROLS.keys().contains(c)) TIME_CONTROLS.get(c).speed else NONE
  pure def _turn(g: PlayGame): str =
    if (g.outcome != OngoingPlay) NOBODY else if (g.moves % 2 == 0) g.white else g.black
  pure def _other(g: PlayGame, p: str): str = if (g.white == p) g.black else g.white
  pure def _plays(g: PlayGame, p: str): bool = g.white == p or g.black == p
  pure def _finished(o: PlayOutcome): bool = o != NoPlay and o != OngoingPlay and o != AbortedPlay

  pure def _unfinishedGames(games: int -> PlayGame, p: str): int = NUMBERS.fold(0, (count, n) => {
    val g = games.get(n)
    if (g.outcome == OngoingPlay and _plays(g, p)) count + 1 else count
  })
  pure def _finishedBalance(games: int -> PlayGame, p: str): int = NUMBERS.fold(0, (balance, n) => {
    val g = games.get(n)
    balance + (if (_finished(g.outcome) and g.white == p) 1 else 0)
      - (if (_finished(g.outcome) and g.black == p) 1 else 0)
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
    val looking = w.seeking.get(p) != NONE
    {
      playNumber: n,
      playSide: if (g.white == p) "White" else if (g.black == p) "Black" else NONE,
      moveCount: g.moves, turn: _turn(g), playOutcome: g.outcome,
      lookingForOpponent: looking,
      lookingSeconds: if (looking) w.searchAge.get(p) else 0,
      timeControl: if (looking) w.seeking.get(p) else g.control,
      whiteClock: g.whiteLeft, blackClock: g.blackLeft,
      drawOffer: g.drawBy, rematchOffer: g.rematchBy,
      ratedGames: w.rated.get(p)
    }
  }

  /// Records a game's new state. A game that just finished counts once
  /// toward both people's rated games at its speed and their colour balance.
  pure def _record(w: PlayWorld, n: int, changed: PlayGame): PlayWorld = {
    val before = w.games.get(n)
    val settled = if (changed.outcome == OngoingPlay) changed else { ...changed, drawBy: NOBODY }
    val games = w.games.set(n, settled)
    if (before.outcome == OngoingPlay and _finished(settled.outcome)) {
      val sp = _speed(settled.control)
      { ...w,
        games: games,
        rated: w.rated
          .setBy(settled.white, r => r.setBy(sp, c => c + 1))
          .setBy(settled.black, r => r.setBy(sp, c => c + 1)),
        balance: w.balance.setBy(settled.white, b => b + 1).setBy(settled.black, b => b - 1) }
    } else { ...w, games: games }
  }

  /// Starts a search at a time control, ending any rematch offer of the
  /// person's last game.
  pure def _search(w: PlayWorld, p: str, control: str): PlayWorld = {
    val n = w.current.get(p)
    { ...w,
      seeking: w.seeking.set(p, control), searchAge: w.searchAge.set(p, 0),
      games: w.games.set(n, { ...w.games.get(n), rematchBy: NOBODY }) }
  }

  /// A rematch of a finished matchmaking game: same people and time
  /// control, colours swapped, numbered two after the earlier game.
  pure def _rematch(w: PlayWorld, number: int): PlayWorld = {
    val g = w.games.get(number)
    val n = number + 2
    { ...w,
      games: w.games.set(number, { ...g, rematchBy: NOBODY }).set(n, { ...NO_GAME,
        white: g.black, black: g.white, control: g.control, outcome: OngoingPlay,
        whiteLeft: _seconds(g.control), blackLeft: _seconds(g.control),
        whiteBalance: w.balance.get(g.black), blackBalance: w.balance.get(g.white) }),
      current: w.current.set(g.white, n).set(g.black, n) }
  }

  /// Seconds passing in one game: a missed first move aborts it, and a
  /// clock reaching zero loses for the side to move.
  pure def _tick(g: PlayGame, s: int): PlayGame =
    if (g.outcome != OngoingPlay) g
    else if (g.moves < 2) {
      if (g.firstMoveWait + s >= FIRST_MOVE_SECONDS)
        { ...g, firstMoveWait: FIRST_MOVE_SECONDS, outcome: AbortedPlay }
      else { ...g, firstMoveWait: g.firstMoveWait + s }
    }
    else if (g.moves % 2 == 0) {
      if (g.whiteLeft <= s) { ...g, whiteLeft: 0, outcome: WonPlay(g.black) }
      else { ...g, whiteLeft: g.whiteLeft - s }
    }
    else {
      if (g.blackLeft <= s) { ...g, blackLeft: 0, outcome: WonPlay(g.white) }
      else { ...g, blackLeft: g.blackLeft - s }
    }

  action _show(w: PlayWorld): bool = {
    val shown = DEVICES.mapBy(d => if (w.offline.contains(d)) _lastKnown.get(d) else _view(w, d.person))
    all {
      _games' = w.games, _sequence' = w.sequence, _received' = w.received,
      _current' = w.current, _seeking' = w.seeking, _searchAge' = w.searchAge,
      _accounts' = w.accounts, _offline' = w.offline, _balance' = w.balance, _rated' = w.rated,
      _lastKnown' = shown,
      playNumber' = DEVICES.mapBy(d => shown.get(d).playNumber),
      playSide' = DEVICES.mapBy(d => shown.get(d).playSide),
      moveCount' = DEVICES.mapBy(d => shown.get(d).moveCount),
      turn' = DEVICES.mapBy(d => shown.get(d).turn),
      playOutcome' = DEVICES.mapBy(d => shown.get(d).playOutcome),
      lookingForOpponent' = DEVICES.mapBy(d => shown.get(d).lookingForOpponent),
      lookingSeconds' = DEVICES.mapBy(d => shown.get(d).lookingSeconds),
      timeControl' = DEVICES.mapBy(d => shown.get(d).timeControl),
      whiteClock' = DEVICES.mapBy(d => shown.get(d).whiteClock),
      blackClock' = DEVICES.mapBy(d => shown.get(d).blackClock),
      drawOffer' = DEVICES.mapBy(d => shown.get(d).drawOffer),
      rematchOffer' = DEVICES.mapBy(d => shown.get(d).rematchOffer),
      ratedGames' = DEVICES.mapBy(d => shown.get(d).ratedGames),
    }
  }

  action init = all {
    _games' = 0.to(4).mapBy(_ => NO_GAME),
    _sequence' = 0.to(4).mapBy(_ => -1),
    _received' = Set(), _current' = PEOPLE.mapBy(_ => 0),
    _seeking' = PEOPLE.mapBy(_ => NONE), _searchAge' = PEOPLE.mapBy(_ => 0),
    _accounts' = PEOPLE, _offline' = Set(),
    _balance' = PEOPLE.mapBy(_ => 0), _rated' = PEOPLE.mapBy(_ => NO_RATINGS),
    _lastKnown' = DEVICES.mapBy(_ => FIRST_VIEW),
    playNumber' = DEVICES.mapBy(_ => 0), playSide' = DEVICES.mapBy(_ => NONE),
    moveCount' = DEVICES.mapBy(_ => 0), turn' = DEVICES.mapBy(_ => NOBODY),
    playOutcome' = DEVICES.mapBy(_ => NoPlay),
    lookingForOpponent' = DEVICES.mapBy(_ => false), lookingSeconds' = DEVICES.mapBy(_ => 0),
    timeControl' = DEVICES.mapBy(_ => NONE),
    whiteClock' = DEVICES.mapBy(_ => 0), blackClock' = DEVICES.mapBy(_ => 0),
    drawOffer' = DEVICES.mapBy(_ => NOBODY), rematchOffer' = DEVICES.mapBy(_ => NOBODY),
    ratedGames' = DEVICES.mapBy(_ => NO_RATINGS),
  }

  /// Opening one's own multiplayer chess never creates or changes a game.
  action openMultiplayer(device: PlayDevice): bool = _show(_now)

  /// Looking for an opponent needs an account, a connection, an offered
  /// time control and no unfinished game.
  action findOpponent(device: PlayDevice, control: str): bool = {
    val p = device.person
    val canAsk = and {
      _canAct(device), not(_unfinished(p)), _seeking.get(p) == NONE,
      TIME_CONTROLS.keys().contains(control),
    }
    _show(if (canAsk) _search(_now, p, control) else _now)
  }

  /// From a game that is over or aborted, look again at its time control.
  action findNewOpponent(device: PlayDevice): bool = {
    val p = device.person
    val g = _game(p)
    val canAsk = and {
      _canAct(device), _current.get(p) != 0, g.outcome != OngoingPlay, _seeking.get(p) == NONE,
    }
    _show(if (canAsk) _search(_now, p, g.control) else _now)
  }

  /// Stopping the search cannot stop an already formed game.
  action stopFindingOpponent(device: PlayDevice): bool =
    _show(if (_offline.contains(device)) _now
      else { ..._now, seeking: _seeking.set(device.person, NONE), searchAge: _searchAge.set(device.person, 0) })

  /// Matchmaking has already chosen two people looking for the same time
  /// control; the one with the greater colour balance plays Black. A match
  /// told again keeps its game.
  action matchFormed(number: int, white: str, black: str): bool = {
    val fact = MatchFormed({ matchmakingMatch: if (number == 1) "first" else "second", people: Set(white, black) })
    val control = _seeking.get(white)
    val repeated = _received.contains(number) and _games.get(number).white == white and _games.get(number).black == black
    val fresh = and {
      not(_received.contains(number)), MATCHES.contains(number), white != black,
      _accounts.contains(white), _accounts.contains(black),
      control != NONE, _seeking.get(black) == control,
      not(_unfinished(white)), not(_unfinished(black)),
      _balance.get(white) <= _balance.get(black),
    }
    all {
      fresh or repeated,
      if (repeated) _show(_now)
      else _show({ ..._now,
        games: _games.set(number, { ...NO_GAME,
          white: white, black: black, control: control, outcome: OngoingPlay,
          whiteLeft: _seconds(control), blackLeft: _seconds(control),
          whiteBalance: _balance.get(white), blackBalance: _balance.get(black) }),
        received: _received.union(Set(number)),
        current: _current.set(white, number).set(black, number),
        seeking: _seeking.set(white, NONE).set(black, NONE),
        searchAge: _searchAge.set(white, 0).set(black, 0) }),
    }
  }

  /// A legal move for this exact game and board counts once, on one's turn.
  /// Once both people have moved it adds the increment to the mover. A move
  /// by the person offered a draw declines it; the offering person's keeps it.
  action playMove(device: PlayDevice, number: int, position: int, legal: bool, sequence: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val counts = and {
      _canAct(device), _current.get(p) == number, g.outcome == OngoingPlay,
      _turn(g) == p, position == g.moves, legal,
    }
    val outcome = if (sequence == 1 and position == 3) WonPlay(g.black)
      else if (sequence == 2 and position == 7) DrawnPlay else OngoingPlay
    val bonus = if (g.moves >= 2) _increment(g.control) else 0
    val moved = { ...g,
      moves: g.moves + 1, outcome: outcome, firstMoveWait: 0,
      whiteLeft: if (g.moves % 2 == 0) g.whiteLeft + bonus else g.whiteLeft,
      blackLeft: if (g.moves % 2 == 1) g.blackLeft + bonus else g.blackLeft,
      drawBy: if (g.drawBy == p) p else NOBODY }
    all {
      not(counts) or position < 8,
      not(counts) or _sequence.get(number) == -1 or _sequence.get(number) == sequence,
      _show(if (counts) { ..._record(_now, number, moved), sequence: _sequence.set(number, sequence) } else _now),
    }
  }

  /// The legal next move of the game a device shows, played for its board.
  action playCurrentMove(device: PlayDevice, sequence: int): bool =
    playMove(device, _current.get(device.person), moveCount.get(device), true, sequence)

  /// Once both people have made their first move, either person can resign
  /// this unfinished game; before that they abort instead. Old resignations stay old.
  action resignPlay(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val resigns = and {
      _canAct(device), _current.get(device.person) == number, g.outcome == OngoingPlay, g.moves >= 2,
    }
    _show(if (resigns) _record(_now, number, { ...g, outcome: WonPlay(_other(g, device.person)) }) else _now)
  }

  /// Either person may abort until both have made their first move. An
  /// aborted game has no winner and counts for nobody.
  action abortPlay(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val aborts = and {
      _canAct(device), _current.get(device.person) == number, g.outcome == OngoingPlay, g.moves < 2,
    }
    _show(if (aborts) _record(_now, number, { ...g, outcome: AbortedPlay }) else _now)
  }

  /// Either person may offer a draw in an unfinished game; offering back
  /// accepts the other person's offer.
  action offerPlayDraw(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val offers = _canAct(device) and _current.get(p) == number and g.outcome == OngoingPlay
    _show(if (not(offers)) _now
      else if (g.drawBy == _other(g, p)) _record(_now, number, { ...g, outcome: DrawnPlay })
      else _record(_now, number, { ...g, drawBy: p }))
  }

  /// Only the person offered a draw can accept it: drawn by agreement.
  action acceptPlayDraw(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val accepts = and {
      _canAct(device), _current.get(p) == number, g.outcome == OngoingPlay, g.drawBy == _other(g, p),
    }
    _show(if (accepts) _record(_now, number, { ...g, outcome: DrawnPlay }) else _now)
  }

  /// Only the person offered a draw can decline it; the game goes on.
  action declinePlayDraw(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val p = device.person
    val declines = and {
      _canAct(device), _current.get(p) == number, g.outcome == OngoingPlay, g.drawBy == _other(g, p),
    }
    _show(if (declines) _record(_now, number, { ...g, drawBy: NOBODY }) else _now)
  }

  /// A rematch needs a finished game that both people still have as their
  /// latest, with neither of them looking for an opponent.
  def _rematchable(p: str, number: int): bool = {
    val g = _games.get(number)
    val q = _other(g, p)
    and {
      _current.get(p) == number, _plays(g, p), _finished(g.outcome),
      _accounts.contains(q), _current.get(q) == number,
      _seeking.get(p) == NONE, _seeking.get(q) == NONE,
    }
  }

  /// After a finished game either person may offer a rematch; offering
  /// back accepts. Bounded here to one rematch of each matchmaking game.
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

  /// Only the person offered a rematch can accept it; the new game starts at once.
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

  /// Confirmed account deletion stops searching, aborts a game in which
  /// both people have not yet moved, gives up other unfinished play and
  /// ends any rematch offer.
  action deletePlayAccount(person: str): bool = {
    val n = _current.get(person)
    val g = _games.get(n)
    val given = if (_unfinished(person) and g.moves < 2) _record(_now, n, { ...g, outcome: AbortedPlay })
      else if (_unfinished(person)) _record(_now, n, { ...g, outcome: WonPlay(_other(g, person)) })
      else { ..._now, games: _games.set(n, { ...g, rematchBy: NOBODY }) }
    _show({ ...given,
      current: _current.set(person, 0), seeking: _seeking.set(person, NONE),
      searchAge: _searchAge.set(person, 0), accounts: _accounts.exclude(Set(person)) })
  }

  /// Seconds pass for every game and search, whoever is online.
  action multiplayerTimePasses(seconds: int): bool = {
    val clocksStopped = NUMBERS.forall(n => _games.get(n).outcome != OngoingPlay)
    val ticked = if (clocksStopped) _now
      else NUMBERS.fold(_now, (w, n) => _record(w, n, _tick(w.games.get(n), seconds)))
    _show({ ...ticked,
      searchAge: PEOPLE.mapBy(p => if (_seeking.get(p) != NONE) _searchAge.get(p) + seconds else _searchAge.get(p)) })
  }

  /// An offline device keeps its last known board; the game and clocks go on.
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
    nondet askedControl = ASKED_CONTROLS.oneOf()
    nondet control = PEOPLE.map(p => _seeking.get(p)).exclude(Set(NONE)).union(Set(askedControl)).oneOf()
    nondet seconds = PASSING_SECONDS.oneOf()
    val moving = DEVICES.filter(d => not(_offline.contains(d)) and _unfinished(d.person) and _turn(_game(d.person)) == d.person)
    nondet moveDevice = moving.union(Set(device)).oneOf()
    nondet moveNumber = Set(anyNumber, _current.get(moveDevice.person)).oneOf()
    nondet earlierPosition = POSITIONS.oneOf()
    nondet position = Set(moveCount.get(moveDevice), earlierPosition).oneOf()
    nondet _rareEvent = 0.to(127).oneOf()
    nondet legal = Set(true, false).oneOf()
    nondet sequence = (if (_sequence.get(moveNumber) >= 0) Set(_sequence.get(moveNumber)) else Set(0, 1, 2)).oneOf()
    val offered = DEVICES.filter(d => {
      val g = _game(d.person)
      (g.drawBy != NOBODY and g.drawBy != d.person) or (g.rematchBy != NOBODY and g.rematchBy != d.person)
    })
    nondet answerDevice = offered.union(Set(device)).oneOf()
    nondet answerNumber = Set(number, _current.get(answerDevice.person)).oneOf()
    nondet matchNumber = MATCHES.oneOf()
    val seekers = PEOPLE.filter(p => _seeking.get(p) != NONE)
    nondet first = (if (_received.contains(matchNumber)) Set(_games.get(matchNumber).white)
      else if (seekers == Set()) PEOPLE else seekers).oneOf()
    val partners = seekers.filter(p => p != first and _seeking.get(p) == _seeking.get(first))
    nondet second = (if (_received.contains(matchNumber)) Set(_games.get(matchNumber).black)
      else if (partners == Set()) PEOPLE.exclude(Set(first)) else partners).oneOf()
    val white = if (_received.contains(matchNumber) or _balance.get(first) <= _balance.get(second)) first else second
    val black = if (white == first) second else first
    any {
      openMultiplayer(device), findOpponent(device, control), findNewOpponent(device),
      stopFindingOpponent(device), matchFormed(matchNumber, white, black),
      playMove(moveDevice, moveNumber, position, legal, sequence),
      playCurrentMove(moveDevice, sequence),
      all { _rareEvent == 0, resignPlay(device, number) },
      all { _rareEvent == 0, deletePlayAccount(person) },
      all { _rareEvent % 8 == 0, abortPlay(device, number) },
      all { _rareEvent % 4 == 0, offerPlayDraw(device, number) },
      acceptPlayDraw(answerDevice, answerNumber), declinePlayDraw(answerDevice, answerNumber),
      offerRematch(device, number),
      acceptRematch(answerDevice, answerNumber), declineRematch(answerDevice, answerNumber),
      all { _rareEvent % 8 == 0, multiplayerTimePasses(seconds) },
      loseConnection(device), comeBackOnline(device),
    }
  }

  /// Every game has two distinct people and fixed colours.
  val invDistinctSides = NUMBERS.forall(n => _games.get(n).outcome != NoPlay implies and {
    _games.get(n).white != _games.get(n).black,
    PEOPLE.contains(_games.get(n).white), PEOPLE.contains(_games.get(n).black),
  })
  /// One person cannot have two unfinished games or look for an opponent during one.
  val invOneUnfinishedGame = PEOPLE.forall(p => and {
    _unfinishedGames(_games, p) <= 1,
    _unfinished(p) implies _seeking.get(p) == NONE,
  })
  /// A winner is one of the two people, nobody moves once a game is over,
  /// only a game in which both people have not yet moved is aborted, and
  /// nobody wins a game before both people have moved.
  val invHonestResult = NUMBERS.forall(n => {
    val g = _games.get(n)
    and {
      g.outcome == NoPlay or g.outcome == OngoingPlay or g.outcome == DrawnPlay or
        g.outcome == AbortedPlay or g.outcome == WonPlay(g.white) or g.outcome == WonPlay(g.black),
      g.outcome != OngoingPlay implies _turn(g) == NOBODY,
      g.outcome == AbortedPlay implies g.moves < 2,
      (g.outcome == WonPlay(g.white) or g.outcome == WonPlay(g.black)) implies g.moves >= 2,
    }
  })
  /// Every person looking for an opponent chooses an offered time control.
  val invSearchTimeControl = PEOPLE.forall(p =>
    _seeking.get(p) == NONE or TIME_CONTROLS.keys().contains(_seeking.get(p)))
  /// Every multiplayer game has an offered time control.
  val invGameTimeControl = NUMBERS.forall(n =>
    _games.get(n).outcome != NoPlay implies TIME_CONTROLS.keys().contains(_games.get(n).control))
  /// A rematch follows a finished game with the same time control and the
  /// colours swapped.
  val invRematchTimeControl = MATCHES.forall(n => _games.get(n + 2).outcome != NoPlay implies and {
    _games.get(n + 2).white == _games.get(n).black,
    _games.get(n + 2).black == _games.get(n).white,
    _games.get(n + 2).control == _games.get(n).control,
    _finished(_games.get(n).outcome),
  })
  /// Of two matched people, the one with the greater colour balance plays
  /// Black; a colour balance counts finished games only.
  val invFairColours = and {
    MATCHES.forall(n => _games.get(n).outcome != NoPlay implies
      _games.get(n).whiteBalance <= _games.get(n).blackBalance),
    PEOPLE.forall(p => _balance.get(p) == _finishedBalance(_games, p)),
  }
  /// Neither clock runs before both first moves, a clock never holds more
  /// than its time plus the increments earned, and a clock at zero lost.
  val invClocks = NUMBERS.forall(n => {
    val g = _games.get(n)
    g.outcome != NoPlay implies and {
      g.moves < 2 implies and { g.whiteLeft == _seconds(g.control), g.blackLeft == _seconds(g.control) },
      g.whiteLeft >= 0, g.blackLeft >= 0,
      g.whiteLeft <= _seconds(g.control) + g.moves * _increment(g.control),
      g.blackLeft <= _seconds(g.control) + g.moves * _increment(g.control),
      g.whiteLeft == 0 implies g.outcome == WonPlay(g.black),
      g.blackLeft == 0 implies g.outcome == WonPlay(g.white),
      g.outcome == OngoingPlay implies g.firstMoveWait < FIRST_MOVE_SECONDS,
    }
  })
  /// Each finished game counts once toward both people's rated multiplayer
  /// games at its speed; an aborted game counts for nobody.
  val invRatedOnce = PEOPLE.forall(p => SPEEDS.forall(sp =>
    _rated.get(p).get(sp) == _finishedRated(_games, p, sp)))
  /// A draw offer belongs to one of the two people of an unfinished game; a
  /// rematch offer to one of the two people of a finished game both still have.
  val invOffers = NUMBERS.forall(n => {
    val g = _games.get(n)
    and {
      g.drawBy != NOBODY implies and { g.outcome == OngoingPlay, _plays(g, g.drawBy) },
      g.rematchBy != NOBODY implies and {
        _finished(g.outcome), _plays(g, g.rematchBy),
        _current.get(g.white) == n, _current.get(g.black) == n,
      },
    }
  })
  /// Online devices show the same accepted game, colour, board, clocks,
  /// offers, search, result and rated games.
  val invDevicesAgree = DEVICES.forall(d => not(_offline.contains(d)) implies {
    val v = _view(_now, d.person)
    and {
      playNumber.get(d) == v.playNumber, playSide.get(d) == v.playSide,
      moveCount.get(d) == v.moveCount, turn.get(d) == v.turn, playOutcome.get(d) == v.playOutcome,
      lookingForOpponent.get(d) == v.lookingForOpponent, lookingSeconds.get(d) == v.lookingSeconds,
      timeControl.get(d) == v.timeControl,
      whiteClock.get(d) == v.whiteClock, blackClock.get(d) == v.blackClock,
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
      lookingForOpponent.get(d) == v.lookingForOpponent, lookingSeconds.get(d) == v.lookingSeconds,
      timeControl.get(d) == v.timeControl,
      whiteClock.get(d) == v.whiteClock, blackClock.get(d) == v.blackClock,
      drawOffer.get(d) == v.drawOffer, rematchOffer.get(d) == v.rematchOffer,
      ratedGames.get(d) == v.ratedGames,
    }
  })
  /// Deleted accounts never keep searching or reach a private game on return.
  val invDeletedCannotPlay = PEOPLE.forall(p => not(_accounts.contains(p)) implies and {
    _seeking.get(p) == NONE, _current.get(p) == 0, not(_unfinished(p)),
  })
  /// Bookkeeping: a game never has fewer than zero accepted moves.
  val invNonnegativeMoveCount = NUMBERS.forall(n => _games.get(n).moves >= 0)
  /// Bookkeeping: games are bounded here to eight accepted moves.
  val invMoveCountLimit = NUMBERS.forall(n => _games.get(n).moves <= 8)
  /// Bookkeeping: a game not yet played has no accepted moves.
  val invUnplayedMoveCount = NUMBERS.forall(n =>
    _games.get(n).outcome == NoPlay implies _games.get(n).moves == 0)
}
