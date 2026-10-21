// Each of the first and second side is a person or a bot in the same custom
// game under way. The creator may watch instead of playing. This follows a
// victory the first side wins with the game's seventh move, with every
// combination of people and bots. A bot's choice among the moves the game
// allows is intentionally not promised; the custom game here is one allowed
// choice. The game's own rules belong to the game itself.
// People lose their connection independently. Bots keep playing their own
// turns on the host's device, including with no connection, in a game
// without a private setup; one with a private setup needs the connection for
// its moves to count. The host keeps
// seeing those moves. A guest sees them while both have a connection, and
// keeps the board they already had while the host has none or their own
// connection is gone.
// Only the creator cancels a custom game with a bot; in a custom game between
// two people the other participant may also cancel until each side has moved.
module custom_game_control {
  pure val PEOPLE = Set("alice","bob")
  pure val SIDES = Set("first","second")
  /// The moves the first side's victory takes; the last one is the winning move.
  pure val VICTORY_MOVES = 7
  /// Who plays each side, independently of the creator's authority.
  var participants: str -> str
  /// The custom game everyone is following: active, completed or cancelled.
  var status: str
  /// Moves actually played, including the winning move.
  var movesPlayed: int
  /// The side whose participant may make the next move.
  var sideToMove: str
  /// The custom game's result, once it is finished or cancelled.
  var result: str
  /// Each person's last board and result.
  var playShown: str -> (str,int,str)
  var _offline: Set[str]
  var _cutOff: str -> (str,int,str)
  var _sealed: bool
  var _finished: (str,int,str)
  var _previousMoves: int
  var _previousSide: str
  var _movingParticipant: str

  def _solo = participants.get("second") == "bot"
  def _visible(actor: str): bool = playShown.get(actor)._1 != "unavailable"
  def _mayChoose(actor: str): bool = not(_offline.contains(actor)) and not(_offline.contains("alice")) or actor == "alice" and _solo
  action _update(newStatus: str, moves: int, turn: str, outcome: str, offline: Set[str], mover: str): bool = all {
    participants' = participants,
    status' = newStatus, movesPlayed' = moves,
    sideToMove' = turn, result' = outcome, _offline' = offline,
    playShown' = PEOPLE.mapBy(p => if (p == "alice" or (not(offline.contains("alice")) and not(offline.contains(p)))) (newStatus,moves,outcome) else playShown.get(p)),
    _cutOff' = PEOPLE.mapBy(p => if(offline.contains(p) and not(_offline.contains(p))) playShown.get(p) else _cutOff.get(p)),
    _sealed' = (_sealed or newStatus != "active"),
    _finished' = if(not(_sealed) and newStatus != "active") (newStatus,moves,outcome) else _finished,
    _previousMoves' = movesPlayed, _previousSide' = sideToMove,
    _movingParticipant' = mover,
  }
  action _hold = _update(status,movesPlayed,sideToMove,result,_offline,"")
  action _move(mover: str): bool = _update(if(movesPlayed == VICTORY_MOVES - 1) "completed" else "active",movesPlayed+1,if(sideToMove == "first") "second" else "first",if(movesPlayed == VICTORY_MOVES - 1) "first side wins by the game's rules" else "",_offline,mover)
  action init = {
    nondet firstSideBot = Set(false,true).oneOf()
    nondet secondSideBot = Set(false,true).oneOf()
    all {
      participants' = Map("first" -> (if(firstSideBot) "bot" else "alice"),"second" -> (if(secondSideBot) "bot" else "bob")),
      status' = "active", movesPlayed' = 0, sideToMove' = "first", result' = "",
      playShown' = PEOPLE.mapBy(_ => ("active",0,"")),
      _offline' = Set(), _cutOff' = PEOPLE.mapBy(_ => ("active",0,"")),
      _sealed' = false, _finished' = ("active",0,""),
      _previousMoves' = 0, _previousSide' = "first", _movingParticipant' = "",
    }
  }
  /// The person whose turn it is may make a move; a watcher cannot move for a bot.
  action playCustomMove(actor: str): bool = all {
    _visible(actor),
    if(status == "active" and _mayChoose(actor) and participants.get(sideToMove) == actor) _move(actor) else _hold
  }
  /// A bot makes only its own move while the custom game is under way.
  action botPlays(side: str): bool = all {
    status == "active", sideToMove == side, participants.get(side) == "bot",
    _move("bot"),
  }
  /// A participating person resigns; watching bots never lets anyone resign.
  action resignCustomGame(actor: str): bool = all {
    if(status == "active" and _mayChoose(actor) and SIDES.exists(c => participants.get(c) == actor))
      _update("completed",movesPlayed,sideToMove,if(participants.get("first") == actor) "second side wins by resignation" else "first side wins by resignation",_offline,"")
    else _hold
  }
  /// The creator can cancel while watching or playing, before the custom game
  /// is finished. In a custom game between two people, the other participant
  /// may cancel until each side has moved.
  action cancelCustomGame(actor: str): bool = all {
    if(status == "active" and _mayChoose(actor) and (actor == "alice" or
        (movesPlayed < 2 and SIDES.forall(c => participants.get(c) != "bot") and SIDES.exists(c => participants.get(c) == actor))))
      _update("cancelled",movesPlayed,sideToMove,"cancelled",_offline,"")
    else _hold
  }
  /// A bot asked to play the other side's turn changes nothing.
  action _wrongBot = _hold
  /// An earlier bot turn cannot play again or bring back a finished custom game.
  action _staleBot = _hold
  action _loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(status,movesPlayed,sideToMove,result,_offline.union(Set(actor)),""),
  }
  action _connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(status,movesPlayed,sideToMove,result,_offline.exclude(Set(actor)),""),
  }
  action step = {
    nondet actor = PEOPLE.oneOf()
    nondet side = SIDES.oneOf()
    any { playCustomMove(actor),botPlays(side),resignCustomGame(actor),cancelCustomGame(actor),_wrongBot,_staleBot,_loseConnection(actor),_connectionReturns(actor) }
  }
  /// A side has just its own person or bot, never shared between them.
  val invParticipants = participants.keys() == SIDES and Set("alice","bot").contains(participants.get("first")) and Set("bob","bot").contains(participants.get("second"))
  /// Every move came from the participant whose turn it was.
  val invOnlyParticipantMoves = movesPlayed != _previousMoves implies _movingParticipant == participants.get(_previousSide)
  /// This allowed history takes turns and includes its winning move.
  val invPlayedHistory = movesPlayed >= 0 and movesPlayed <= VICTORY_MOVES and (status == "active" implies sideToMove == (if(movesPlayed % 2 == 0) "first" else "second")) and (movesPlayed == VICTORY_MOVES) == (result == "first side wins by the game's rules")
  /// A custom game that is over has a result, and that board and result never change.
  val invFinishedStays = ((status != "active") == (result != "")) and (_sealed implies (status,movesPlayed,result) == _finished)
  /// The host sees the custom game as it is, including while their own device has no connection.
  val invHostSeesGame = playShown.get("alice") == (status,movesPlayed,result)
  /// A guest sees that custom game while they and the host both have a connection.
  val invGuestAgrees = (not(_offline.contains("alice")) and not(_offline.contains("bob"))) implies playShown.get("bob") == (status,movesPlayed,result)
  /// A guest with no connection keeps the board they had before losing it.
  /// The host keeps seeing their own bots' moves.
  val invGuestOffline = _offline.contains("bob") implies playShown.get("bob") == _cutOff.get("bob")
  val _state = (participants,status,movesPlayed,sideToMove,result,playShown,_offline,_cutOff,_sealed,_finished,_previousMoves,_previousSide,_movingParticipant)
  temporal _botsKeepPlaying = botPlays("first").weakFair(_state) and botPlays("second").weakFair(_state)
  /// A custom game between two bots eventually finishes while their turns continue to be played.
  temporal liveBotsFinish = (participants.get("first") == "bot" and participants.get("second") == "bot" and _botsKeepPlaying).implies((status == "active").leadsTo(status != "active"))
}
