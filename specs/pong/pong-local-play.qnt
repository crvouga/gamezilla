// @model-profile: local
// Alice shares her device with Bob, or plays a bot on it. The game is ready
// before she starts it, under way until a victory, then finished. Losing or
// regaining the connection never changes this local game or who can guide
// its paddles. Reopening the app keeps each stage. Scoring belongs to Pong's
// scoring model; this model follows local availability and paddle guidance.
module pong_local_play {
  var localOpponent: str
  var localStage: str
  var gameShown: bool
  var controlledPaddles: Set[str]
  var _online: bool

  action _keep(nextStage: str, online: bool): bool = all {
    localOpponent' = localOpponent,
    localStage' = nextStage,
    gameShown' = true,
    controlledPaddles' = if (nextStage == "playing")
      (if (localOpponent == "person") Set("left", "right") else Set("left")) else Set(),
    _online' = online,
  }

  action init = {
    nondet opponent = Set("person", "bot").oneOf()
    all {
      localOpponent' = opponent, localStage' = "ready", gameShown' = true,
      controlledPaddles' = Set(), _online' = true,
    }
  }

  /// Alice starts the local Pong game for which she is ready.
  action startLocalPong = all {
    localStage == "ready", _keep("playing", _online),
  }

  /// Alice's device loses its connection to other people.
  action loseConnection = all { _online, _keep(localStage, false) }

  /// Alice's device can reach other people again.
  action connectionReturns = all { not(_online), _keep(localStage, true) }

  /// A victory finishes the local game, whether or not the device has a connection.
  action finishLocalPong = all {
    localStage == "playing", _keep("finished", _online),
  }

  /// Opening the app again keeps the local game and its stage.
  action reopenApp = _keep(localStage, _online)

  action step = any {
    startLocalPong, loseConnection, connectionReturns, finishLocalPong, reopenApp,
  }

  /// Local Pong remains available without needing a connection.
  val invLocalAvailability = gameShown

  /// Two people share both paddles; against a bot, Alice guides only her own.
  val invLocalPaddles = controlledPaddles == (if (localStage == "playing")
    (if (localOpponent == "person") Set("left", "right") else Set("left")) else Set())

  /// A finished local game has no paddle Alice can keep guiding.
  val invFinishedPaddles = localStage == "finished" implies controlledPaddles == Set()
}
