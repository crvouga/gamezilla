// White and Black play one Custom Game from the usual starting position.
// This follows the four-move game ending in Black's checkmate. The chess
// laws govern which moves are legal; this model concerns who may play,
// time, resignation, cancellation and the terminal boundary. Time is counted
// in quarter minutes. Both sides begin with one minute and no increment.
// Offline people keep their last board and cannot play; the clock runs and
// the current position and outcome return when their connection returns.
module custom_game_play {
  type Person = str
  type Color = str
  pure val PEOPLE = Set("alice", "bob")
  pure val COLORS = Set("white", "black")
  pure val _INITIAL_TIME = 4
  pure val _WAITS = Set(1, 2, 4)

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

  pure def _color(actor: Person): Color = if (actor == "alice") "white" else "black"
  pure def _other(color: Color): Color = if (color == "white") "black" else "white"
  action _update(status: str, moves: int, turn: Color, outcome: str, left: Color -> int, offline: Set[Person]): bool = all {
    playStatus' = status, ply' = moves, sideToMove' = turn, result' = outcome,
    clockLeft' = left, _offline' = offline,
    playShown' = PEOPLE.mapBy(p => if (offline.contains(p)) playShown.get(p) else (status,moves,outcome)),
    _atCutOff' = PEOPLE.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) playShown.get(p) else _atCutOff.get(p)),
    _ended' = (_ended or status != "active"),
    _terminalPicture' = if (not(_ended) and status != "active") (status,moves,outcome,left) else _terminalPicture,
  }
  action _hold = _update(playStatus,ply,sideToMove,result,clockLeft,_offline)
  action init = all {
    playStatus' = "active", ply' = 0, sideToMove' = "white", result' = "",
    clockLeft' = COLORS.mapBy(_ => _INITIAL_TIME), _offline' = Set(),
    playShown' = PEOPLE.mapBy(_ => ("active",0,"")),
    _atCutOff' = PEOPLE.mapBy(_ => ("active",0,"")),
    _ended' = false, _terminalPicture' = ("active",0,"",COLORS.mapBy(_ => _INITIAL_TIME)),
  }
  /// The assigned person plays the next legal move, or hears a refusal.
  action playCustomMove(actor: Person): bool =
    if (not(_offline.contains(actor)) and playStatus == "active" and _color(actor) == sideToMove)
      _update(if (ply == 3) "completed" else "active",ply+1,_other(sideToMove),if (ply == 3) "black wins by checkmate" else "",clockLeft,_offline)
    else _hold
  /// An illegal move cannot spend another side's time or change the board.
  action _illegalMove(actor: Person): bool = _hold
  /// A participating person resigns, while the game is active.
  action resignCustomGame(actor: Person): bool =
    if (not(_offline.contains(actor)) and playStatus == "active")
      _update("completed",ply,sideToMove,if (actor == "alice") "black wins by resignation" else "white wins by resignation",clockLeft,_offline)
    else _hold
  /// The creator cancels an unfinished game, including while watching.
  action cancelCustomGame(actor: Person): bool =
    if (actor == "alice" and not(_offline.contains(actor)) and playStatus == "active")
      _update("cancelled",ply,sideToMove,"cancelled",clockLeft,_offline)
    else _hold
  /// Quarter minutes pass, including while people are offline.
  action customTimePasses(quarters: int): bool =
    if (playStatus != "active") _hold
    else if (quarters >= clockLeft.get(sideToMove))
      _update("completed",ply,sideToMove,if (sideToMove == "white") "black wins on time" else "white wins on time",clockLeft.set(sideToMove,0),_offline)
    else _update(playStatus,ply,sideToMove,result,clockLeft.set(sideToMove,clockLeft.get(sideToMove)-quarters),_offline)
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
      playCustomMove(actor), resignCustomGame(actor), cancelCustomGame(actor),
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
  val _state = (playStatus,ply,sideToMove,result,clockLeft,playShown,_offline,_atCutOff,_terminalPicture,_ended)
  temporal _timeKeepsPassing = customTimePasses(1).weakFair(_state)
  /// A timed game eventually ends while time continues to pass.
  temporal liveTimedGameEnds = _timeKeepsPassing.implies((playStatus == "active").leadsTo(playStatus != "active"))
  /// Once someone stays online, their board eventually agrees with the game.
  temporal liveReturnedBoard = PEOPLE.forall(p => eventually(always(not(_offline.contains(p)))).implies(eventually(always(playShown.get(p) == (playStatus,ply,result)))))
}
