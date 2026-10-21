// Alice and Bob play one custom game from the game's starting position.
// It follows the first three moves of a victory the first side wins by the
// game's rules; none of them finishes the custom game. The game's own rules
// decide which moves are allowed and how a custom game is won by them; this
// model concerns who may make a move, time, resignation, cancellation and
// what a finished custom game keeps. Time is counted in quarter minutes.
// Both sides begin with one minute and no added seconds.
// People with no connection keep their last board and cannot play; the clock
// runs, and the current board and result return when their connection
// returns while the host has one. A guest keeps the board they have while
// the host has none, until the custom game has a result. When neither participant can play the
// shared custom game, it keeps the same board and pauses time and being
// away; nobody wins for staying away then.
// Alice takes the first side and is the creator, Bob takes the second side,
// and Carol watches. A participant with no connection is away: being away
// never gives up the custom game, and a timed custom game's clock keeps
// running for them. After a minute away, the other participant may claim the
// win; a watcher never can. The custom game may also be untimed. Either
// participant may cancel until each side has moved; afterwards only the
// creator may cancel.
module custom_game_play {
  type Person = str
  type Side = str
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val SIDES = Set("first", "second")
  /// The custom game's first moves this model follows; none of them finishes it.
  pure val FIRST_MOVES = 3
  pure val _INITIAL_TIME = 4
  pure val _WAITS = Set(1, 2, 4)
  /// How long a participant must be away before a claim, in quarter minutes.
  pure val _AWAY_LIMIT = 4
  pure val _STAYED_AWAY = Set("first side wins because the second side stayed away", "second side wins because the first side stayed away")
  pure val _RESULTS = Set("", "cancelled", "first side wins by resignation", "second side wins by resignation", "first side wins on time", "second side wins on time").union(_STAYED_AWAY)

  /// The custom game's agreed state may finish while no connected person can see it.
  var _playStatus: str
  /// Moves played in this custom game.
  var movesPlayed: int
  /// The side whose participant may make the next move.
  var sideToMove: Side
  /// The agreed result returns when the host returns; it is private while hidden.
  var _result: str
  /// Quarter minutes each side has left.
  var clockLeft: Side -> int
  /// Each person's last board and custom game state.
  var playShown: Person -> (str, int, str)
  /// A timed shared custom game shows paused clocks while neither participant can play.
  var clocksPaused: bool
  var _available: bool
  var _previousAvailable: bool
  var _previousClocks: Side -> int
  var _previousStatus: str
  var _offline: Set[Person]
  var _atCutOff: Person -> (str, int, str)
  var _terminalPicture: (str, int, str, Side -> int)
  var _ended: bool
  /// Bookkeeping: quarter minutes each person has been away, up to the limit.
  var _awayFor: Person -> int
  /// Bookkeeping: whether this custom game has clocks.
  var _timed: bool
  /// Bookkeeping: who cancelled the custom game, if anyone.
  var _canceller: Person
  /// Bookkeeping: how long the other participant had been away when the win was claimed.
  var _claimedAfter: int

  pure def _side(actor: Person): Side = if (actor == "alice") "first" else if (actor == "bob") "second" else ""
  pure def _other(side: Side): Side = if (side == "first") "second" else "first"
  pure def _opponent(actor: Person): Person = if (actor == "alice") "bob" else "alice"
  pure def _capped(quarters: int): int = if (quarters > _AWAY_LIMIT) _AWAY_LIMIT else quarters
  def _visible(actor: Person): bool = playShown.get(actor)._1 != "unavailable"
  /// A connected guest keeps the board they have while the host has no connection, until a result.
  pure def _keepsBoard(p: Person, offline: Set[Person], status: str): bool =
    p != "alice" and offline.contains("alice") and status == "active"
  action _update(status: str, moves: int, turn: Side, outcome: str, left: Side -> int, offline: Set[Person]): bool =
    _updateAll(status,moves,turn,outcome,left,offline,PEOPLE.mapBy(p => if (offline.contains(p)) _awayFor.get(p) else 0),_canceller,_claimedAfter)
  action _updateAll(status: str, moves: int, turn: Side, outcome: str, left: Side -> int, offline: Set[Person], away: Person -> int, canceller: Person, claimedAfter: int): bool =
    _recordAll(status,moves,turn,outcome,left,offline,away,canceller,claimedAfter,_available)
  action _recordAll(status: str, moves: int, turn: Side, outcome: str, left: Side -> int, offline: Set[Person], away: Person -> int, canceller: Person, claimedAfter: int, available: bool): bool = all {
    _available' = available, clocksPaused' = (_timed and status == "active" and not(available)),
    _previousAvailable' = _available, _previousClocks' = clockLeft, _previousStatus' = _playStatus,
    _awayFor' = away, _timed' = _timed, _canceller' = canceller, _claimedAfter' = claimedAfter,
    _playStatus' = status, movesPlayed' = moves, sideToMove' = turn, _result' = outcome,
    clockLeft' = left, _offline' = offline,
    playShown' = PEOPLE.mapBy(p => if (offline.contains(p) or _keepsBoard(p,offline,status)) playShown.get(p) else (status,moves,outcome)),
    _atCutOff' = PEOPLE.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) playShown.get(p) else _atCutOff.get(p)),
    _ended' = (_ended or status != "active"),
    _terminalPicture' = if (not(_ended) and status != "active") (status,moves,outcome,left) else _terminalPicture,
  }
  action _hold = _update(_playStatus,movesPlayed,sideToMove,_result,clockLeft,_offline)
  action init = {
    nondet timed = Set(false, true).oneOf()
    all {
    _timed' = timed,
    clocksPaused' = false, _available' = true, _previousAvailable' = true,
    _previousClocks' = SIDES.mapBy(_ => _INITIAL_TIME), _previousStatus' = "active",
    _awayFor' = PEOPLE.mapBy(_ => 0), _canceller' = "", _claimedAfter' = 0,
    _playStatus' = "active", movesPlayed' = 0, sideToMove' = "first", _result' = "",
    clockLeft' = SIDES.mapBy(_ => _INITIAL_TIME), _offline' = Set(),
    playShown' = PEOPLE.mapBy(_ => ("active",0,"")),
    _atCutOff' = PEOPLE.mapBy(_ => ("active",0,"")),
    _ended' = false, _terminalPicture' = ("active",0,"",SIDES.mapBy(_ => _INITIAL_TIME)),
    }
  }
  /// The participant whose turn it is makes the victory's next move, or hears a refusal.
  action playCustomMove(actor: Person): bool = all {
    _visible(actor), movesPlayed < FIRST_MOVES,
    if (_available and not(_offline.contains(actor)) and not(_offline.contains("alice")) and _playStatus == "active" and _side(actor) == sideToMove)
      _update(_playStatus,movesPlayed+1,_other(sideToMove),_result,clockLeft,_offline)
    else _hold
  }
  /// A move the game refuses cannot spend another side's time or change the board.
  action _illegalMove(actor: Person): bool = all { _visible(actor), _hold }
  /// A participating person resigns, while the custom game is under way; a watcher cannot.
  action resignCustomGame(actor: Person): bool = all {
    _visible(actor),
    if (_available and not(_offline.contains(actor)) and not(_offline.contains("alice")) and _playStatus == "active" and _side(actor) != "")
      _update("completed",movesPlayed,sideToMove,if (actor == "alice") "second side wins by resignation" else "first side wins by resignation",clockLeft,_offline)
    else _hold
  }
  /// The creator cancels an unfinished custom game, including while watching.
  /// The other participant may cancel only until each side has moved.
  action cancelCustomGame(actor: Person): bool = all {
    _visible(actor),
    if (_available and not(_offline.contains(actor)) and not(_offline.contains("alice")) and _playStatus == "active" and (actor == "alice" or (_side(actor) != "" and movesPlayed < 2)))
      _updateAll("cancelled",movesPlayed,sideToMove,"cancelled",clockLeft,_offline,_awayFor,actor,_claimedAfter)
    else _hold
  }
  /// A participant claims the win once the other participant has been away
  /// for a minute; earlier, or for a watcher, nothing changes.
  action claimWin(actor: Person): bool = all {
    _visible(actor),
    if (_available and _playStatus == "active" and _side(actor) != "" and not(_offline.contains(actor)) and not(_offline.contains("alice"))
        and _offline.contains(_opponent(actor)) and _awayFor.get(_opponent(actor)) >= _AWAY_LIMIT)
      _updateAll("completed",movesPlayed,sideToMove,
        if (actor == "alice") "first side wins because the second side stayed away" else "second side wins because the first side stayed away",
        clockLeft,_offline,_awayFor,_canceller,_awayFor.get(_opponent(actor)))
    else _hold
  }
  /// Quarter minutes pass, including while people are away. Only a timed
  /// custom game's side to move spends time.
  action customTimePasses(quarters: int): bool = {
    val away = PEOPLE.mapBy(p => if (_offline.contains(p)) _capped(_awayFor.get(p) + quarters) else 0)
    if (_playStatus != "active" or not(_available)) _hold
    else if (not(_timed))
      _updateAll(_playStatus,movesPlayed,sideToMove,_result,clockLeft,_offline,away,_canceller,_claimedAfter)
    else if (quarters >= clockLeft.get(sideToMove))
      _updateAll("completed",movesPlayed,sideToMove,if (sideToMove == "first") "second side wins on time" else "first side wins on time",clockLeft.set(sideToMove,0),_offline,away,_canceller,_claimedAfter)
    else _updateAll(_playStatus,movesPlayed,sideToMove,_result,clockLeft.set(sideToMove,clockLeft.get(sideToMove)-quarters),_offline,away,_canceller,_claimedAfter)
  }
  /// A repeated acknowledged move has no second effect.
  action _repeatMove = _hold
  /// Changing the set-up or a side after the start is unavailable.
  action _changeStartedGame = _hold
  /// One person loses their connection; their board stays as it was.
  action _loseConnection(actor: Person): bool = all {
    not(_offline.contains(actor)),
    _update(_playStatus,movesPlayed,sideToMove,_result,clockLeft,_offline.union(Set(actor))),
  }
  /// A returning person sees the agreed current board and result.
  action _connectionReturns(actor: Person): bool = all {
    _offline.contains(actor),
    _update(_playStatus,movesPlayed,sideToMove,_result,clockLeft,_offline.exclude(Set(actor))),
  }
  /// Checking machinery: the shared custom game cannot be played by either participant.
  action _sharedPlayStops = all {
    _available, _recordAll(_playStatus,movesPlayed,sideToMove,_result,clockLeft,_offline,_awayFor,_canceller,_claimedAfter,false),
  }
  /// Checking machinery: the same shared custom game becomes playable again.
  action _sharedPlayReturns = all {
    not(_available), _recordAll(_playStatus,movesPlayed,sideToMove,_result,clockLeft,_offline,_awayFor,_canceller,_claimedAfter,true),
  }
  action step = {
    nondet actor = PEOPLE.oneOf()
    nondet quarters = _WAITS.oneOf()
    any {
      playCustomMove(actor), resignCustomGame(actor), cancelCustomGame(actor), claimWin(actor),
      customTimePasses(quarters), _illegalMove(actor), _repeatMove,
      _changeStartedGame, _loseConnection(actor), _connectionReturns(actor), _sharedPlayStops, _sharedPlayReturns,
    }
  }
  /// Moves and turn remain those of one game whose sides take turns.
  val invTurnAndMoves = movesPlayed >= 0 and movesPlayed <= FIRST_MOVES and (_playStatus == "active" implies sideToMove == (if (movesPlayed % 2 == 0) "first" else "second"))
  /// Only a finished or cancelled custom game has a result.
  val invFinalResult = (_playStatus != "active") == (_result != "")
  /// A finished board, result and clocks cannot change.
  val invTerminalFrozen = _ended implies (_playStatus,movesPlayed,_result,clockLeft) == _terminalPicture
  /// None of these moves finishes the custom game: only resigning, time, a claim or cancelling does.
  val invMovesNeverFinish = _RESULTS.contains(_result)
  /// A side under way still has time; neither clock is negative or gains time.
  val invClocks = SIDES.forall(c => clockLeft.get(c) >= 0 and clockLeft.get(c) <= _INITIAL_TIME) and (_playStatus == "active" implies clockLeft.get(sideToMove) > 0)
  /// Everyone with a connection sees the same board and result, a guest while the host has one or once there is a result.
  val invConnectedBoard = PEOPLE.forall(p => not(_offline.contains(p) or _keepsBoard(p,_offline,_playStatus)) implies playShown.get(p) == (_playStatus,movesPlayed,_result))
  /// Boards with no connection stay as they were when the connection went.
  val invOfflineBoard = PEOPLE.forall(p => _offline.contains(p) implies playShown.get(p) == _atCutOff.get(p))
  /// Only the creator cancels once each side has moved.
  val invEarlyCancelOnly = (_playStatus == "cancelled" and _canceller != "alice") implies (movesPlayed < 2 and _side(_canceller) != "")
  /// A win for staying away needs the other participant away for a full minute.
  val invClaimNeedsAbsence = _STAYED_AWAY.contains(_result) implies _claimedAfter >= _AWAY_LIMIT
  /// Being away never finishes the custom game by itself: an away result always comes from a claim.
  val invAwayNeverResigns = (_claimedAfter > 0) == _STAYED_AWAY.contains(_result)
  /// A shared pause keeps the time left, including when play resumes.
  val invSharedPauseKeepsTime = (_previousStatus == "active" and not(_previousAvailable)) implies clockLeft == _previousClocks
  /// Only a timed shared custom game under way can show paused clocks.
  val invPauseIsHonest = clocksPaused == (_timed and _playStatus == "active" and not(_available))
  val _state = (clocksPaused,_available,_previousAvailable,_previousClocks,_previousStatus,_playStatus,movesPlayed,sideToMove,_result,clockLeft,playShown,_offline,_atCutOff,_terminalPicture,_ended,_awayFor,_timed,_canceller,_claimedAfter)
  temporal _timeKeepsPassing = customTimePasses(1).weakFair(_state)
  /// A timed custom game eventually finishes while time continues to pass.
  temporal liveTimedGameEnds = (_timed and _timeKeepsPassing and eventually(always(_available))).implies((_playStatus == "active").leadsTo(_playStatus != "active"))
  /// Once someone stays connected, their board eventually agrees with the custom game.
  temporal liveReturnedBoard = PEOPLE.forall(p => eventually(always(not(_offline.contains(p)) and not(_offline.contains("alice")))).implies(eventually(always(playShown.get(p) == (_playStatus,movesPlayed,_result)))))
}
