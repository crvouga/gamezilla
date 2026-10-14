// Each of White and Black is a person or a bot in the same active game.
// The creator may watch instead of playing. This follows one legal four-move
// game ending in Black's checkmate, with every person-and-bot combination.
// A bot's choice among legal moves is intentionally not promised; the game
// here is one allowed choice. Other chess laws belong to chess itself.
// People lose their connection independently. Bots keep playing their own
// turns on the host device, including offline. The host keeps seeing those
// moves. A guest sees them while both have a connection, and keeps the board
// they already had while the host is offline or their own connection is gone.
// Only the creator cancels a game with a bot; in a game between two people
// the other participant may also cancel until each side has moved.
module custom_game_control {
  pure val PEOPLE = Set("alice","bob")
  pure val COLORS = Set("white","black")
  /// Who controls each side, independently of the creator's authority.
  var controllers: str -> str
  /// The active, completed or cancelled game everyone is following.
  var controlledStatus: str
  /// Moves actually played, including the final mating move.
  var controlledPly: int
  /// The side whose participant is allowed to move.
  var controlledTurn: str
  /// The game's final result, once it has ended.
  var controlledOutcome: str
  /// Each person's last board and result.
  var controlledShown: str -> (str,int,str)
  var _offline: Set[str]
  var _cutOff: str -> (str,int,str)
  var _sealed: bool
  var _finished: (str,int,str)
  var _previousPly: int
  var _previousTurn: str
  var _movingController: str

  def _solo = controllers.get("black") == "bot"
  def _visible(actor: str): bool = controlledShown.get(actor)._1 != "unavailable"
  def _mayChoose(actor: str): bool = not(_offline.contains(actor)) and not(_offline.contains("alice")) or actor == "alice" and _solo
  action _update(status: str, moves: int, turn: str, outcome: str, offline: Set[str], controller: str): bool = all {
    controllers' = controllers,
    controlledStatus' = status, controlledPly' = moves,
    controlledTurn' = turn, controlledOutcome' = outcome, _offline' = offline,
    controlledShown' = PEOPLE.mapBy(p => if (p == "alice" or (not(offline.contains("alice")) and not(offline.contains(p)))) (status,moves,outcome) else controlledShown.get(p)),
    _cutOff' = PEOPLE.mapBy(p => if(offline.contains(p) and not(_offline.contains(p))) controlledShown.get(p) else _cutOff.get(p)),
    _sealed' = (_sealed or status != "active"),
    _finished' = if(not(_sealed) and status != "active") (status,moves,outcome) else _finished,
    _previousPly' = controlledPly, _previousTurn' = controlledTurn,
    _movingController' = controller,
  }
  action _hold = _update(controlledStatus,controlledPly,controlledTurn,controlledOutcome,_offline,"")
  action _move(controller: str): bool = _update(if(controlledPly == 3) "completed" else "active",controlledPly+1,if(controlledTurn == "white") "black" else "white",if(controlledPly == 3) "black wins by checkmate" else "",_offline,controller)
  action init = {
    nondet whiteBot = Set(false,true).oneOf()
    nondet blackBot = Set(false,true).oneOf()
    all {
      controllers' = Map("white" -> (if(whiteBot) "bot" else "alice"),"black" -> (if(blackBot) "bot" else "bob")),
      controlledStatus' = "active", controlledPly' = 0, controlledTurn' = "white", controlledOutcome' = "",
      controlledShown' = PEOPLE.mapBy(_ => ("active",0,"")),
      _offline' = Set(), _cutOff' = PEOPLE.mapBy(_ => ("active",0,"")),
      _sealed' = false, _finished' = ("active",0,""),
      _previousPly' = 0, _previousTurn' = "white", _movingController' = "",
    }
  }
  /// The person assigned to the turn may play; a watcher cannot move for a bot.
  action playControlledMove(actor: str): bool = all {
    _visible(actor),
    if(controlledStatus == "active" and _mayChoose(actor) and controllers.get(controlledTurn) == actor) _move(actor) else _hold
  }
  /// A bot plays only its own turn while the game remains active.
  action botPlays(side: str): bool = all {
    controlledStatus == "active", controlledTurn == side, controllers.get(side) == "bot",
    _move("bot"),
  }
  /// An assigned person resigns; watching bots never grants resignation.
  action resignControlledGame(actor: str): bool = all {
    if(controlledStatus == "active" and _mayChoose(actor) and COLORS.exists(c => controllers.get(c) == actor))
      _update("completed",controlledPly,controlledTurn,if(controllers.get("white") == actor) "black wins by resignation" else "white wins by resignation",_offline,"")
    else _hold
  }
  /// The creator can cancel while watching or playing, before completion. In a
  /// game between two people, the other participant may cancel until each side has moved.
  action cancelControlledGame(actor: str): bool = all {
    if(controlledStatus == "active" and _mayChoose(actor) and (actor == "alice" or
        (controlledPly < 2 and COLORS.forall(c => controllers.get(c) != "bot") and COLORS.exists(c => controllers.get(c) == actor))))
      _update("cancelled",controlledPly,controlledTurn,"cancelled",_offline,"")
    else _hold
  }
  /// A bot asked to play the wrong turn changes nothing.
  action _wrongBot = _hold
  /// An earlier bot turn cannot play again or revive a terminal game.
  action _staleBot = _hold
  action _loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(controlledStatus,controlledPly,controlledTurn,controlledOutcome,_offline.union(Set(actor)),""),
  }
  action _connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(controlledStatus,controlledPly,controlledTurn,controlledOutcome,_offline.exclude(Set(actor)),""),
  }
  action step = {
    nondet actor = PEOPLE.oneOf()
    nondet side = COLORS.oneOf()
    any { playControlledMove(actor),botPlays(side),resignControlledGame(actor),cancelControlledGame(actor),_wrongBot,_staleBot,_loseConnection(actor),_connectionReturns(actor) }
  }
  /// A side has just its assigned person or bot, never shared control.
  val invControllers = controllers.keys() == COLORS and Set("alice","bot").contains(controllers.get("white")) and Set("bob","bot").contains(controllers.get("black"))
  /// Every move came from the participant who controlled the preceding turn.
  val invOnlyControllerMoves = controlledPly != _previousPly implies _movingController == controllers.get(_previousTurn)
  /// This allowed chess history alternates turns and includes its mating move.
  val invControlledHistory = controlledPly >= 0 and controlledPly <= 4 and (controlledStatus == "active" implies controlledTurn == (if(controlledPly % 2 == 0) "white" else "black")) and (controlledPly == 4) == (controlledOutcome == "black wins by checkmate")
  /// Terminal games have a result, and that board and result never change.
  val invControlledTerminal = ((controlledStatus != "active") == (controlledOutcome != "")) and (_sealed implies (controlledStatus,controlledPly,controlledOutcome) == _finished)
  /// The host sees the live game, including while their own device is offline.
  val invControlledHost = controlledShown.get("alice") == (controlledStatus,controlledPly,controlledOutcome)
  /// A guest sees that game while they and the host both have a connection.
  val invControlledAgreement = (not(_offline.contains("alice")) and not(_offline.contains("bob"))) implies controlledShown.get("bob") == (controlledStatus,controlledPly,controlledOutcome)
  /// An offline guest retains the picture they had before losing their connection.
  /// The host continues to see their own local bot moves.
  val invControlledOffline = _offline.contains("bob") implies controlledShown.get("bob") == _cutOff.get("bob")
  val _state = (controllers,controlledStatus,controlledPly,controlledTurn,controlledOutcome,controlledShown,_offline,_cutOff,_sealed,_finished,_previousPly,_previousTurn,_movingController)
  temporal _botsKeepPlaying = botPlays("white").weakFair(_state) and botPlays("black").weakFair(_state)
  /// A game between two bots eventually ends while their turns continue to be played.
  temporal liveBotsFinish = (controllers.get("white") == "bot" and controllers.get("black") == "bot" and _botsKeepPlaying).implies((controlledStatus == "active").leadsTo(controlledStatus != "active"))
}
