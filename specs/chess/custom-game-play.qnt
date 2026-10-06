// White and Black play one Custom Game from the usual starting position.
// This follows the four-move game ending in Black's checkmate. The chess
// laws govern which moves are legal; this model concerns who may play,
// time, resignation, cancellation and the terminal boundary. Time is counted
// in quarter minutes. Both sides begin with one minute and no increment.
// Offline people keep their last board and cannot play; the clock runs and
// the current position and outcome return when their connection returns.
// Alice is White and the creator, Bob is Black, and Carol watches. A
// participant with no connection is away: being away never gives up the game,
// and a timed game's clock keeps running for them. After a minute away, the
// other participant may claim the win; a watcher never can. The game may also
// be untimed. Either participant may cancel until each side has moved;
// afterwards only the creator may cancel.
module custom_game_play {
  type Person = str
  type Color = str
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val COLORS = Set("white", "black")
  pure val _INITIAL_TIME = 4
  pure val _WAITS = Set(1, 2, 4)
  /// How long a participant must be away before a claim, in quarter minutes.
  pure val _AWAY_LIMIT = 4
  pure val _STAYED_AWAY = Set("white wins because black stayed away", "black wins because white stayed away")

  /// The game's active, completed or cancelled state.
  var playStatus: str
  /// Moves played in this game, including the mating move.
  var ply: int
  /// The side whose participant may move.
  var sideToMove: Color
  /// The result shown to everyone, once completed or cancelled.
  var result: str
  /// Quarter minutes each side has left.
  var clockLeft: Color -> int
  /// Each person's last board and game state.
  var playShown: Person -> (str, int, str)
  var _offline: Set[Person]
  var _atCutOff: Person -> (str, int, str)
  var _terminalPicture: (str, int, str, Color -> int)
  var _ended: bool
  /// Bookkeeping: quarter minutes each person has been away, up to the limit.
  var _awayFor: Person -> int
  /// Bookkeeping: whether this game has clocks.
  var _timed: bool
  /// Bookkeeping: who cancelled the game, if anyone.
  var _canceller: Person
  /// Bookkeeping: how long the other participant had been away when the win was claimed.
  var _claimedAfter: int

  pure def _color(actor: Person): Color = if (actor == "alice") "white" else if (actor == "bob") "black" else ""
  pure def _other(color: Color): Color = if (color == "white") "black" else "white"
  pure def _opponent(actor: Person): Person = if (actor == "alice") "bob" else "alice"
  pure def _capped(quarters: int): int = if (quarters > _AWAY_LIMIT) _AWAY_LIMIT else quarters
  action _update(status: str, moves: int, turn: Color, outcome: str, left: Color -> int, offline: Set[Person]): bool =
    _updateAll(status,moves,turn,outcome,left,offline,PEOPLE.mapBy(p => if (offline.contains(p)) _awayFor.get(p) else 0),_canceller,_claimedAfter)
  action _updateAll(status: str, moves: int, turn: Color, outcome: str, left: Color -> int, offline: Set[Person], away: Person -> int, canceller: Person, claimedAfter: int): bool = all {
    _awayFor' = away, _timed' = _timed, _canceller' = canceller, _claimedAfter' = claimedAfter,
    playStatus' = status, ply' = moves, sideToMove' = turn, result' = outcome,
    clockLeft' = left, _offline' = offline,
    playShown' = PEOPLE.mapBy(p => if (offline.contains(p)) playShown.get(p) else (status,moves,outcome)),
    _atCutOff' = PEOPLE.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) playShown.get(p) else _atCutOff.get(p)),
    _ended' = (_ended or status != "active"),
    _terminalPicture' = if (not(_ended) and status != "active") (status,moves,outcome,left) else _terminalPicture,
  }
  action _hold = _update(playStatus,ply,sideToMove,result,clockLeft,_offline)
  action init = {
    nondet timed = Set(false, true).oneOf()
    all {
    _timed' = timed,
    _awayFor' = PEOPLE.mapBy(_ => 0), _canceller' = "", _claimedAfter' = 0,
    playStatus' = "active", ply' = 0, sideToMove' = "white", result' = "",
    clockLeft' = COLORS.mapBy(_ => _INITIAL_TIME), _offline' = Set(),
    playShown' = PEOPLE.mapBy(_ => ("active",0,"")),
    _atCutOff' = PEOPLE.mapBy(_ => ("active",0,"")),
    _ended' = false, _terminalPicture' = ("active",0,"",COLORS.mapBy(_ => _INITIAL_TIME)),
    }
  }
  /// The assigned person plays the next legal move, or hears a refusal.
  action playCustomMove(actor: Person): bool =
    if (not(_offline.contains(actor)) and playStatus == "active" and _color(actor) == sideToMove)
      _update(if (ply == 3) "completed" else "active",ply+1,_other(sideToMove),if (ply == 3) "black wins by checkmate" else "",clockLeft,_offline)
    else _hold
  /// An illegal move cannot spend another side's time or change the board.
  action _illegalMove(actor: Person): bool = _hold
  /// A participating person resigns, while the game is active; a watcher cannot.
  action resignCustomGame(actor: Person): bool =
    if (not(_offline.contains(actor)) and playStatus == "active" and _color(actor) != "")
      _update("completed",ply,sideToMove,if (actor == "alice") "black wins by resignation" else "white wins by resignation",clockLeft,_offline)
    else _hold
  /// The creator cancels an unfinished game, including while watching. The
  /// other participant may cancel only until each side has moved.
  action cancelCustomGame(actor: Person): bool =
    if (not(_offline.contains(actor)) and playStatus == "active" and (actor == "alice" or (_color(actor) != "" and ply < 2)))
      _updateAll("cancelled",ply,sideToMove,"cancelled",clockLeft,_offline,_awayFor,actor,_claimedAfter)
    else _hold
  /// A participant claims the win once the other participant has been away
  /// for a minute; earlier, or for a watcher, nothing changes.
  action claimWin(actor: Person): bool =
    if (playStatus == "active" and _color(actor) != "" and not(_offline.contains(actor))
        and _offline.contains(_opponent(actor)) and _awayFor.get(_opponent(actor)) >= _AWAY_LIMIT)
      _updateAll("completed",ply,sideToMove,
        if (actor == "alice") "white wins because black stayed away" else "black wins because white stayed away",
        clockLeft,_offline,_awayFor,_canceller,_awayFor.get(_opponent(actor)))
    else _hold
  /// Quarter minutes pass, including while people are away. Only a timed
  /// game's side to move spends time.
  action customTimePasses(quarters: int): bool = {
    val away = PEOPLE.mapBy(p => if (_offline.contains(p)) _capped(_awayFor.get(p) + quarters) else 0)
    if (playStatus != "active") _hold
    else if (not(_timed))
      _updateAll(playStatus,ply,sideToMove,result,clockLeft,_offline,away,_canceller,_claimedAfter)
    else if (quarters >= clockLeft.get(sideToMove))
      _updateAll("completed",ply,sideToMove,if (sideToMove == "white") "black wins on time" else "white wins on time",clockLeft.set(sideToMove,0),_offline,away,_canceller,_claimedAfter)
    else _updateAll(playStatus,ply,sideToMove,result,clockLeft.set(sideToMove,clockLeft.get(sideToMove)-quarters),_offline,away,_canceller,_claimedAfter)
  }
  /// A repeated acknowledged move has no second effect.
  action _repeatMove = _hold
  /// Configuration and side acquisition after start are unavailable.
  action _changeStartedGame = _hold
  /// One person loses their connection; their board stays as it was.
  action _loseConnection(actor: Person): bool = all {
    not(_offline.contains(actor)),
    _update(playStatus,ply,sideToMove,result,clockLeft,_offline.union(Set(actor))),
  }
  /// A returning person sees the agreed current board and result.
  action _connectionReturns(actor: Person): bool = all {
    _offline.contains(actor),
    _update(playStatus,ply,sideToMove,result,clockLeft,_offline.exclude(Set(actor))),
  }
  action step = {
    nondet actor = PEOPLE.oneOf()
    nondet quarters = _WAITS.oneOf()
    any {
      playCustomMove(actor), resignCustomGame(actor), cancelCustomGame(actor), claimWin(actor),
      customTimePasses(quarters), _illegalMove(actor), _repeatMove,
      _changeStartedGame, _loseConnection(actor), _connectionReturns(actor),
    }
  }
  /// Moves and turn remain those of one legal alternating game.
  val invTurnAndMoves = ply >= 0 and ply <= 4 and (playStatus == "active" implies sideToMove == (if (ply % 2 == 0) "white" else "black"))
  /// Only a terminal game has a final outcome.
  val invFinalResult = (playStatus != "active") == (result != "")
  /// A terminal board, result and clocks cannot change.
  val invTerminalFrozen = _ended implies (playStatus,ply,result,clockLeft) == _terminalPicture
  /// A checkmate includes the mating move; time losses never include it.
  val invMatingMoveCounts = (result == "black wins by checkmate" implies ply == 4) and (ply == 4 implies result == "black wins by checkmate")
  /// An active side still has time; neither clock is negative or gains time.
  val invClocks = COLORS.forall(c => clockLeft.get(c) >= 0 and clockLeft.get(c) <= _INITIAL_TIME) and (playStatus == "active" implies clockLeft.get(sideToMove) > 0)
  /// Everyone with a connection sees the same board and outcome.
  val invConnectedBoard = PEOPLE.forall(p => not(_offline.contains(p)) implies playShown.get(p) == (playStatus,ply,result))
  /// Offline boards stay as they were when the connection went.
  val invOfflineBoard = PEOPLE.forall(p => _offline.contains(p) implies playShown.get(p) == _atCutOff.get(p))
  /// Only the creator cancels once each side has moved.
  val invEarlyCancelOnly = (playStatus == "cancelled" and _canceller != "alice") implies (ply < 2 and _color(_canceller) != "")
  /// A win for staying away needs the other participant away for a full minute.
  val invClaimNeedsAbsence = _STAYED_AWAY.contains(result) implies _claimedAfter >= _AWAY_LIMIT
  /// Being away never ends the game by itself: an away result always comes from a claim.
  val invAwayNeverResigns = (_claimedAfter > 0) == _STAYED_AWAY.contains(result)
  val _state = (playStatus,ply,sideToMove,result,clockLeft,playShown,_offline,_atCutOff,_terminalPicture,_ended,_awayFor,_timed,_canceller,_claimedAfter)
  temporal _timeKeepsPassing = customTimePasses(1).weakFair(_state)
  /// A timed game eventually ends while time continues to pass.
  temporal liveTimedGameEnds = (_timed and _timeKeepsPassing).implies((playStatus == "active").leadsTo(playStatus != "active"))
  /// Once someone stays online, their board eventually agrees with the game.
  temporal liveReturnedBoard = PEOPLE.forall(p => eventually(always(not(_offline.contains(p)))).implies(eventually(always(playShown.get(p) == (playStatus,ply,result)))))
}
