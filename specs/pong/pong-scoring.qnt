// @model-profile: local
// Alice has the left paddle and Bob has the right paddle on one device.
// Short games to one or two points show how a serve, a point and a victory
// change the score. Pong needs no connection for this local play.
// Closing and reopening the app keeps every point and a finished victory.
module pong_scoring {
  pure val _PADDLES = Set("left", "right")
  var score: str -> int
  var targetScore: int
  /// Pong is counting down, in play, or finished.
  var stage: str
  /// No winner before the victory, then the left or right paddle's person.
  var winner: str
  var _scoreAtFinish: str -> int
  var _beforeReopen: str -> int
  var _reopened: bool

  action _update(points: str -> int, phase: str, victor: str, reopened: bool): bool = all {
    score' = points,
    targetScore' = targetScore,
    stage' = phase,
    winner' = victor,
    _scoreAtFinish' = (if (stage == "finished") _scoreAtFinish else if (phase == "finished") points else _scoreAtFinish),
    _beforeReopen' = score,
    _reopened' = reopened,
  }

  action init = {
    nondet target = Set(1, 2).oneOf()
    all {
      score' = _PADDLES.mapBy(_ => 0), targetScore' = target,
      stage' = "countdown", winner' = "",
      _scoreAtFinish' = _PADDLES.mapBy(_ => 0),
      _beforeReopen' = _PADDLES.mapBy(_ => 0), _reopened' = false,
    }
  }

  /// The countdown ends and the serve begins.
  action countdownEnds = all {
    stage == "countdown",
    _update(score, "playing", "", false),
  }

  /// The ball passes the other paddle and wins one point for this paddle's person.
  action pointWon(paddle: str): bool = {
    val points = score.set(paddle, score.get(paddle) + 1)
    val finished = points.get(paddle) == targetScore
    all {
      stage == "playing", _PADDLES.contains(paddle),
      _update(points, if (finished) "finished" else "countdown", if (finished) paddle else "", false),
    }
  }

  /// Time passing after the victory keeps its finished score.
  action waitAfterFinish = all {
    stage == "finished", _update(score, stage, winner, false),
  }

  /// Opening the app again leaves local Pong as it was.
  action reopenApp = _update(score, stage, winner, true)

  action step = {
    nondet paddle = _PADDLES.oneOf()
    any { countdownEnds, pointWon(paddle), waitAfterFinish, reopenApp }
  }

  /// Neither person's score is negative or above the target score.
  val invScores = targetScore > 0 and _PADDLES.forall(p => score.get(p).in(0.to(targetScore)))
  /// Pong ends exactly when one person reaches the target score.
  val invVictory = if (_PADDLES.contains(winner))
    stage == "finished" and score.get(winner) == targetScore
    else winner == "" and Set("countdown", "playing").contains(stage) and
      _PADDLES.forall(p => score.get(p) < targetScore)
  /// A finished game cannot add or lose a point.
  val invFinishedScore = stage == "finished" implies score == _scoreAtFinish
  /// Opening the app again keeps the score.
  val invReopening = _reopened implies score == _beforeReopen
}
