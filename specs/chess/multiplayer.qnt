// A matchmaking match gives its two people one shared, untimed chess game.
// The game owns the sides, moves and result, never the pairing algorithm.
// Either side assignment is permitted. People cannot search while their game
// is unfinished. Repeating the same match keeps the same game.
//
// Four people each have two devices. Two successive games and eight moves
// expose competing devices, stale moves, old resignations and repeated
// handoffs. The finite move histories are an ordinary opening, Fool's Mate
// and two repetitions of both knights returning home. Other chess moves and
// ending positions are governed by the chess rules and their examples.
// An offline device keeps its last accepted board and cannot move or resign.
// Returning shows the accepted game and result.
module multiplayer {
  import events.* from "../matchmaking/events"

  type PlayDevice = { person: str, place: str }
  type PlayOutcome = NoPlay | OngoingPlay | WonPlay(str) | DrawnPlay
  type PlayGame = { white: str, black: str, moves: int, outcome: PlayOutcome }
  pure val PEOPLE = Set("alice", "bob", "carol", "dave")
  pure val DEVICES = PEOPLE.map(p => Set("phone", "computer").map(d => { person: p, place: d })).flatten()
  pure val NUMBERS = Set(1, 2)
  pure val POSITIONS = Set(0, 1, 2, 3, 4, 5, 6, 7)

  /// The person's current multiplayer game, or none yet.
  var playNumber: PlayDevice -> int
  /// How many accepted moves are shown on this device's multiplayer board.
  var moveCount: PlayDevice -> int
  /// Who may move next, or nobody after a result.
  var turn: PlayDevice -> str
  /// The multiplayer result, or that play is still unfinished.
  var playOutcome: PlayDevice -> PlayOutcome
  /// Whether this person is looking for a chess opponent.
  var lookingForOpponent: PlayDevice -> bool

  var _games: int -> PlayGame
  var _sequence: int -> int
  var _received: Set[int]
  var _current: str -> int
  var _seeking: Set[str]
  var _accounts: Set[str]
  var _offline: Set[PlayDevice]
  var _lastNumber: PlayDevice -> int
  var _lastMoves: PlayDevice -> int
  var _lastTurn: PlayDevice -> str
  var _lastOutcome: PlayDevice -> PlayOutcome
  var _lastSeeking: PlayDevice -> bool

  def _game(p: str): PlayGame = _games.get(_current.get(p))
  def _unfinished(p: str): bool = _current.get(p) != 0 and _game(p).outcome == OngoingPlay
  pure def _turn(g: PlayGame): str =
    if (g.outcome != OngoingPlay) "nobody"
    else if (g.moves % 2 == 0) g.white else g.black

  action _show(games, received, current, seeking, accounts, offline) = all {
    _games' = games, _received' = received, _current' = current,
    _sequence' = _sequence,
    _seeking' = seeking, _accounts' = accounts, _offline' = offline,
    playNumber' = DEVICES.mapBy(d => if (offline.contains(d)) playNumber.get(d) else current.get(d.person)),
    moveCount' = DEVICES.mapBy(d => if (offline.contains(d)) moveCount.get(d) else games.get(current.get(d.person)).moves),
    turn' = DEVICES.mapBy(d => if (offline.contains(d)) turn.get(d) else _turn(games.get(current.get(d.person)))),
    playOutcome' = DEVICES.mapBy(d => if (offline.contains(d)) playOutcome.get(d) else games.get(current.get(d.person)).outcome),
    lookingForOpponent' = DEVICES.mapBy(d => if (offline.contains(d)) lookingForOpponent.get(d) else seeking.contains(d.person)),
    _lastNumber' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) playNumber.get(d) else _lastNumber.get(d)),
    _lastMoves' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) moveCount.get(d) else _lastMoves.get(d)),
    _lastTurn' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) turn.get(d) else _lastTurn.get(d)),
    _lastOutcome' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) playOutcome.get(d) else _lastOutcome.get(d)),
    _lastSeeking' = DEVICES.mapBy(d => if (offline.contains(d) and not(_offline.contains(d))) lookingForOpponent.get(d) else _lastSeeking.get(d)),
  }

  action init = all {
    _games' = Set(0, 1, 2).mapBy(_ => { white: "nobody", black: "nobody", moves: 0, outcome: NoPlay }),
    _sequence' = Set(0, 1, 2).mapBy(_ => -1),
    _received' = Set(), _current' = PEOPLE.mapBy(_ => 0), _seeking' = Set(),
    _accounts' = PEOPLE, _offline' = Set(),
    playNumber' = DEVICES.mapBy(_ => 0), moveCount' = DEVICES.mapBy(_ => 0),
    turn' = DEVICES.mapBy(_ => "nobody"), playOutcome' = DEVICES.mapBy(_ => NoPlay),
    lookingForOpponent' = DEVICES.mapBy(_ => false),
    _lastNumber' = DEVICES.mapBy(_ => 0), _lastMoves' = DEVICES.mapBy(_ => 0),
    _lastTurn' = DEVICES.mapBy(_ => "nobody"), _lastOutcome' = DEVICES.mapBy(_ => NoPlay),
    _lastSeeking' = DEVICES.mapBy(_ => false),
  }

  /// Opening one's own multiplayer chess never creates or changes a game.
  action openMultiplayer(device: PlayDevice): bool =
    _show(_games, _received, _current, _seeking, _accounts, _offline)

  /// The game supplies availability and asks matchmaking for an opponent.
  action findOpponent(device: PlayDevice): bool = {
    val canAsk = not(_offline.contains(device)) and _accounts.contains(device.person) and not(_unfinished(device.person))
    _show(_games, _received, _current,
      if (canAsk) _seeking.union(Set(device.person)) else _seeking, _accounts, _offline)
  }

  /// Stopping the upstream wait cannot stop an already formed game.
  action stopFindingOpponent(device: PlayDevice): bool =
    _show(_games, _received, _current,
      if (_offline.contains(device)) _seeking else _seeking.exclude(Set(device.person)), _accounts, _offline)

  /// Matchmaking has already chosen the people. Repeated facts keep the game.
  action matchFormed(number: int, white: str, black: str): bool = {
    val fact = MatchFormed({ matchmakingMatch: if (number == 1) "first" else "second", people: Set(white, black) })
    all {
      white != black,
      (_received.contains(number) and _games.get(number).white == white and _games.get(number).black == black) or and {
        not(_received.contains(number)),
        _seeking.contains(white), _seeking.contains(black),
        _accounts.contains(white), _accounts.contains(black),
        not(_unfinished(white)), not(_unfinished(black)),
      },
      if (_received.contains(number)) _show(_games, _received, _current, _seeking, _accounts, _offline)
      else _show(_games.set(number, { white: white, black: black, moves: 0, outcome: OngoingPlay }),
        _received.union(Set(number)), _current.set(white, number).set(black, number),
        _seeking.exclude(Set(white, black)), _accounts, _offline)
    }
  }

  /// A legal move for this exact game and board counts once, on one's turn.
  action playMove(device: PlayDevice, number: int, position: int, legal: bool, sequence: int): bool = {
    val g = _games.get(number)
    val counts = and {
      not(_offline.contains(device)), _accounts.contains(device.person),
      _current.get(device.person) == number, _received.contains(number),
      g.outcome == OngoingPlay, _turn(g) == device.person,
      position == g.moves, legal,
    }
    val outcome = if (sequence == 1 and position == 3) WonPlay(g.black)
      else if (sequence == 2 and position == 7) DrawnPlay else OngoingPlay
    all {
      not(counts) or position < 8,
      not(counts) or _sequence.get(number) == -1 or _sequence.get(number) == sequence,
      _games' = if (counts) _games.set(number, { ...g, moves: g.moves + 1, outcome: outcome }) else _games,
      _sequence' = if (counts) _sequence.set(number, sequence) else _sequence,
      _received' = _received, _current' = _current, _seeking' = _seeking,
      _accounts' = _accounts, _offline' = _offline,
      playNumber' = playNumber,
      moveCount' = DEVICES.mapBy(d => if (_offline.contains(d) or _current.get(d.person) != number or not(counts)) moveCount.get(d) else g.moves + 1),
      turn' = DEVICES.mapBy(d => if (_offline.contains(d) or _current.get(d.person) != number or not(counts)) turn.get(d) else _turn({ ...g, moves: g.moves + 1, outcome: outcome })),
      playOutcome' = DEVICES.mapBy(d => if (_offline.contains(d) or _current.get(d.person) != number or not(counts)) playOutcome.get(d) else outcome),
      lookingForOpponent' = lookingForOpponent,
      _lastNumber' = _lastNumber, _lastMoves' = _lastMoves, _lastTurn' = _lastTurn,
      _lastOutcome' = _lastOutcome, _lastSeeking' = _lastSeeking,
    }
  }

  /// Either person can resign this unfinished game; old resignations stay old.
  action resignPlay(device: PlayDevice, number: int): bool = {
    val g = _games.get(number)
    val resigns = not(_offline.contains(device)) and _accounts.contains(device.person) and
      _current.get(device.person) == number and g.outcome == OngoingPlay
    val winner = if (g.white == device.person) g.black else g.white
    _show(if (resigns) _games.set(number, { ...g, outcome: WonPlay(winner) }) else _games,
      _received, _current, _seeking, _accounts, _offline)
  }

  /// Confirmed account deletion stops searching and gives up unfinished play.
  action deletePlayAccount(person: str): bool = {
    val n = _current.get(person)
    val g = _games.get(n)
    val winner = if (g.white == person) g.black else g.white
    _show(if (_unfinished(person)) _games.set(n, { ...g, outcome: WonPlay(winner) }) else _games,
      _received, _current.set(person, 0), _seeking.exclude(Set(person)), _accounts.exclude(Set(person)), _offline)
  }

  /// An offline device keeps its last accepted board; the untimed game stays.
  action loseConnection(device: PlayDevice): bool = all {
    not(_offline.contains(device)),
    _show(_games, _received, _current, _seeking, _accounts, _offline.union(Set(device))),
  }

  /// Returning shows accepted moves and the result, without a new command.
  action comeBackOnline(device: PlayDevice): bool = all {
    _offline.contains(device),
    _show(_games, _received, _current, _seeking, _accounts, _offline.exclude(Set(device))),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet person = PEOPLE.oneOf()
    nondet number = NUMBERS.oneOf()
    val moving = DEVICES.filter(d => not(_offline.contains(d)) and _unfinished(d.person) and _turn(_game(d.person)) == d.person)
    nondet moveDevice = moving.union(Set(device)).oneOf()
    nondet moveNumber = Set(number, _current.get(moveDevice.person)).exclude(Set(0)).oneOf()
    nondet earlierPosition = POSITIONS.oneOf()
    nondet position = Set(moveCount.get(moveDevice), earlierPosition).oneOf()
    nondet _rareEvent = 0.to(127).oneOf()
    nondet legal = Set(true, false).oneOf()
    nondet sequence = (if (_sequence.get(moveNumber) >= 0) Set(_sequence.get(moveNumber)) else Set(0, 1, 2)).oneOf()
    nondet matchNumber = NUMBERS.oneOf()
    nondet white = (if (_received.contains(matchNumber)) Set(_games.get(matchNumber).white)
      else if (_seeking == Set()) PEOPLE else _seeking).oneOf()
    val candidates = _seeking.exclude(Set(white))
    nondet black = (if (_received.contains(matchNumber)) Set(_games.get(matchNumber).black)
      else if (candidates == Set()) PEOPLE.exclude(Set(white)) else candidates).oneOf()
    any {
      openMultiplayer(device), findOpponent(device), stopFindingOpponent(device),
      matchFormed(matchNumber, white, black), playMove(moveDevice, moveNumber, position, legal, sequence),
      all { _rareEvent == 0, resignPlay(device, number) },
      all { _rareEvent == 0, deletePlayAccount(person) },
      loseConnection(device), comeBackOnline(device),
    }
  }

  /// Every game has two distinct people, fixed sides and one accepted identity.
  val invDistinctSides = _received.forall(n => and {
    _games.get(n).white != _games.get(n).black,
    PEOPLE.contains(_games.get(n).white), PEOPLE.contains(_games.get(n).black),
  })
  /// One person cannot have two unfinished games or seek an opponent during one.
  val invOneUnfinishedGame = PEOPLE.forall(p => and {
    _received.filter(n => _games.get(n).outcome == OngoingPlay and
      (_games.get(n).white == p or _games.get(n).black == p)).size() <= 1,
    _unfinished(p) implies not(_seeking.contains(p)),
  })
  /// A winner is one of the two matched people and nobody moves after a result.
  val invHonestResult = _received.forall(n => {
    val g = _games.get(n)
    and {
      g.outcome == OngoingPlay or g.outcome == DrawnPlay or
        g.outcome == WonPlay(g.white) or g.outcome == WonPlay(g.black),
      g.outcome != OngoingPlay implies _turn(g) == "nobody",
    }
  })
  /// Online devices see the same accepted game, board, turn and result.
  val invDevicesAgree = DEVICES.forall(d => not(_offline.contains(d)) implies and {
    playNumber.get(d) == _current.get(d.person),
    moveCount.get(d) == _game(d.person).moves,
    turn.get(d) == _turn(_game(d.person)), playOutcome.get(d) == _game(d.person).outcome,
    lookingForOpponent.get(d) == _seeking.contains(d.person),
  })
  /// Offline devices keep their last known board and search until returning.
  val invOfflineBoard = DEVICES.forall(d => _offline.contains(d) implies and {
    playNumber.get(d) == _lastNumber.get(d), moveCount.get(d) == _lastMoves.get(d),
    turn.get(d) == _lastTurn.get(d), playOutcome.get(d) == _lastOutcome.get(d),
    lookingForOpponent.get(d) == _lastSeeking.get(d),
  })
  /// Deleted accounts never keep searching or access a game on return.
  val invDeletedCannotPlay = PEOPLE.forall(p => not(_accounts.contains(p)) implies and {
    not(_seeking.contains(p)), _current.get(p) == 0, not(_unfinished(p)),
  })
  /// Bookkeeping: only received games have ordinary accepted moves, bounded here to eight.
  val invAcceptedMoves = NUMBERS.forall(n => and {
    _games.get(n).moves >= 0, _games.get(n).moves <= 8,
    not(_received.contains(n)) implies _games.get(n).moves == 0,
  })
  val _wellFormed = and {
    _received.subseteq(NUMBERS), _seeking.subseteq(_accounts),
    _accounts.subseteq(PEOPLE), _offline.subseteq(DEVICES),
    NUMBERS.forall(n => Set(-1, 0, 1, 2).contains(_sequence.get(n))),
    _games.get(0) == { white: "nobody", black: "nobody", moves: 0, outcome: NoPlay },
    PEOPLE.forall(p => _current.get(p) == 0 or and {
      _received.contains(_current.get(p)),
      _game(p).white == p or _game(p).black == p,
    }),
    NUMBERS.forall(n => {
      val g = _games.get(n)
      and {
        not(_received.contains(n)) implies g == { white: "nobody", black: "nobody", moves: 0, outcome: NoPlay },
        g.outcome == OngoingPlay implies and {
          _current.get(g.white) == n, _current.get(g.black) == n,
        },
      }
    }),
  }
  pure val _people = PEOPLE.union(Set("nobody"))
  pure val _outcomes = Set(NoPlay, OngoingPlay, DrawnPlay).union(PEOPLE.map(p => WonPlay(p)))
  pure val _gameValues = tuples(_people, _people, 0.to(8), _outcomes).map(t =>
    { white: t._1, black: t._2, moves: t._3, outcome: t._4 })
  val _proof = all {
    _games.in(Set(0, 1, 2).setOfMaps(_gameValues)),
    _sequence.in(Set(0, 1, 2).setOfMaps(Set(-1, 0, 1, 2))),
    _received.in(NUMBERS.powerset()),
    _current.in(PEOPLE.setOfMaps(Set(0, 1, 2))),
    _seeking.in(PEOPLE.powerset()),
    _accounts.in(PEOPLE.powerset()),
    _offline.in(DEVICES.powerset()),
    _lastNumber.in(DEVICES.setOfMaps(Set(0, 1, 2))),
    _lastMoves.in(DEVICES.setOfMaps(0.to(8))),
    _lastTurn.in(DEVICES.setOfMaps(_people)),
    _lastOutcome.in(DEVICES.setOfMaps(_outcomes)),
    _lastSeeking.in(DEVICES.setOfMaps(Set(true, false))),
    playNumber.in(DEVICES.setOfMaps(Set(0, 1, 2))),
    moveCount.in(DEVICES.setOfMaps(0.to(8))),
    turn.in(DEVICES.setOfMaps(_people)),
    playOutcome.in(DEVICES.setOfMaps(_outcomes)),
    lookingForOpponent.in(DEVICES.setOfMaps(Set(true, false))),

    _wellFormed, invDistinctSides, invOneUnfinishedGame, invHonestResult,
    invDevicesAgree, invOfflineBoard, invDeletedCannotPlay, invAcceptedMoves,
  }

}
