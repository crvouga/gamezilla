// @model-profile: local
// Alice and Bob play one matched game of the game, at first Alice on the
// first side and Bob on the second, and Carol watches it. Each of them has
// their own board on their own device.
//
// Each of them can review any earlier position of the matched game on their
// own board: choose a move in the move list, step back or forward one move,
// go to the start, or return to the current position in one step. While a
// person reviews an earlier position no move can be made on their board. A
// move accepted meanwhile joins the move list and leaves their board on the
// position they chose until they return.
//
// Each person sees their own side nearest them, and the watcher the first
// side. A rematch swaps the sides and starts every board afresh: Alice's and
// Bob's each with their own new side nearest, and Carol's with the first
// side nearest.
//
// Once the matched game is over with a result, each of them can copy its
// game record or its final position. An unfinished or aborted matched game
// offers neither.
//
// Reviewing an earlier position and copying change only what that one person
// has in front of them: nobody else's board changes, no move is made and the
// turn stays where it is. None of it needs a connection: each uses only what
// the person's own device already shows, which with no connection is its
// last known board.
//
// The matched game follows the first four moves of the game's known victory,
// none of which finishes it, and ends by one person resigning or aborting.
// Other endings, the clocks, draw offers, how a rematch is offered and what
// the game itself lets a person do with their own board follow the matched
// game and the game's own rules.
module matched_game_own_board {
  type PlayOutcome = OngoingPlay | WonPlay(str) | DrawnPlay | AbortedPlay

  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val MATCHED = Set("alice", "bob")
  pure val MOST_MOVES = 4
  pure val CURRENT = -1

  /// How many accepted moves the move list shows to everyone.
  var moveCount: int
  /// That the matched game is unfinished, its result, or that it was aborted.
  var playOutcome: PlayOutcome
  /// The side each person has: "first" or "second", and "none" for the watcher.
  var playSide: str -> str
  /// The earlier position each person is reviewing, as the number of moves
  /// played to reach it, or -1 while their board shows the current position.
  var earlierPosition: str -> int
  /// The side each person's board shows nearest them: "first" or "second".
  var nearestSide: str -> str
  /// Whether the game record and the final position are offered for copying.
  var gameRecordOffered: bool

  var _first: str

  pure def _other(p: str): str = if (p == "alice") "bob" else "alice"
  pure def _side(p: str, first: str): str =
    if (p == first) "first" else if (MATCHED.contains(p)) "second" else "none"
  /// A person sees their own side nearest, and a watcher the first side.
  pure def _nearest(p: str, first: str): str =
    if (_side(p, first) == "second") "second" else "first"
  pure def _hasResult(o: PlayOutcome): bool = o != OngoingPlay and o != AbortedPlay
  def _shownPosition(p: str): int =
    if (earlierPosition.get(p) == CURRENT) moveCount else earlierPosition.get(p)
  def _toMove: str = if (moveCount % 2 == 0) _first else _other(_first)

  action _show(moves: int, outcome: PlayOutcome, first: str, earlier: str -> int): bool = all {
    moveCount' = moves, playOutcome' = outcome, _first' = first,
    earlierPosition' = earlier,
    playSide' = PEOPLE.mapBy(p => _side(p, first)),
    nearestSide' = PEOPLE.mapBy(p => _nearest(p, first)),
    gameRecordOffered' = _hasResult(outcome),
  }
  /// One person's board shows the position after that many moves; the
  /// position after the latest move is the current position.
  action _review(person: str, position: int): bool =
    _show(moveCount, playOutcome, _first,
      earlierPosition.set(person, if (position >= moveCount) CURRENT else position))
  action _unchanged: bool = _show(moveCount, playOutcome, _first, earlierPosition)

  action init = all {
    moveCount' = 0, playOutcome' = OngoingPlay, _first' = "alice",
    earlierPosition' = PEOPLE.mapBy(_ => CURRENT),
    playSide' = PEOPLE.mapBy(p => _side(p, "alice")),
    nearestSide' = PEOPLE.mapBy(p => _nearest(p, "alice")),
    gameRecordOffered' = false,
  }

  /// The person whose turn it is makes the victory's next move, on the
  /// current position only: while they review an earlier position no move
  /// is made. The move list gains the move for everyone, and a board on an
  /// earlier position stays there. Bounded here to four accepted moves.
  action playMove(person: str): bool = {
    val moves = and {
      playOutcome == OngoingPlay, person == _toMove, earlierPosition.get(person) == CURRENT,
    }
    all {
      not(moves) or moveCount < MOST_MOVES,
      _show(if (moves) moveCount + 1 else moveCount, playOutcome, _first, earlierPosition),
    }
  }

  /// Once both people have moved, either of them resigns and the other wins.
  action resignGame(person: str): bool = all {
    playOutcome == OngoingPlay, moveCount >= 2, MATCHED.contains(person),
    _show(moveCount, WonPlay(_other(person)), _first, earlierPosition),
  }

  /// Until both people have moved, either of them aborts the matched game.
  action abortGame(person: str): bool = all {
    playOutcome == OngoingPlay, moveCount < 2, MATCHED.contains(person),
    _show(moveCount, AbortedPlay, _first, earlierPosition),
  }

  /// One of the two people accepts a rematch of a matched game that is over
  /// with a result; an aborted one has none. The new matched game swaps the
  /// sides, and everyone's board shows its current position, each with its
  /// own side nearest again.
  action acceptRematch(person: str): bool = all {
    _hasResult(playOutcome), MATCHED.contains(person),
    _show(0, OngoingPlay, _other(_first), PEOPLE.mapBy(_ => CURRENT)),
  }

  /// Choosing a move in the move list shows the position after it on the
  /// person's own board. Choosing the latest move shows the current position.
  action chooseEarlierPosition(person: str, position: int): bool = all {
    position >= 1, position <= moveCount,
    _review(person, position),
  }

  /// Stepping back shows the position one move earlier. At the start of the
  /// matched game there is none to step back to.
  action stepBackOneMove(person: str): bool = all {
    _shownPosition(person) > 0,
    _review(person, _shownPosition(person) - 1),
  }

  /// Stepping forward from an earlier position shows the next one; from the
  /// last of them it returns to the current position.
  action stepForwardOneMove(person: str): bool = all {
    earlierPosition.get(person) != CURRENT,
    _review(person, earlierPosition.get(person) + 1),
  }

  /// Going to the start shows the board before any move.
  action goToStart(person: str): bool = all {
    moveCount > 0,
    _review(person, 0),
  }

  /// Returning to the current position takes one step from any earlier position.
  action returnToCurrentPosition(person: str): bool = all {
    earlierPosition.get(person) != CURRENT,
    _review(person, moveCount),
  }

  /// Copying the game record of a matched game that is over with a result
  /// changes nothing on anyone's board.
  action copyGameRecord(person: str): bool = all { gameRecordOffered, _unchanged }

  /// Copying the final position of such a matched game changes nothing either.
  action copyFinalPosition(person: str): bool = all { gameRecordOffered, _unchanged }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet position = 1.to(MOST_MOVES).oneOf()
    any {
      playMove(person), resignGame(person), abortGame(person), acceptRematch(person),
      chooseEarlierPosition(person, position), stepBackOneMove(person),
      stepForwardOneMove(person), goToStart(person), returnToCurrentPosition(person),
      copyGameRecord(person), copyFinalPosition(person),
    }
  }

  /// A person only ever reviews a position the matched game was really in,
  /// before its current position.
  val invEarlierPositionWasPlayed = PEOPLE.forall(p => or {
    earlierPosition.get(p) == CURRENT,
    earlierPosition.get(p) >= 0 and earlierPosition.get(p) < moveCount,
  })
  /// One of the two people has the first side and the other the second; the
  /// watcher has neither.
  val invFixedSides = and {
    Set(playSide.get("alice"), playSide.get("bob")) == Set("first", "second"),
    playSide.get("carol") == "none",
  }
  /// Each board shows its person's own side nearest, and a watcher's the first side.
  val invOwnSideNearest = PEOPLE.forall(p =>
    nearestSide.get(p) == (if (playSide.get(p) == "second") "second" else "first"))
  /// The game record and the final position are offered exactly when the
  /// matched game is over with a result: never while it is unfinished, and
  /// never once it was aborted.
  val invGameRecordNeedsResult = gameRecordOffered iff or {
    playOutcome == WonPlay("alice"), playOutcome == WonPlay("bob"), playOutcome == DrawnPlay,
  }
  /// Only a matched game in which both people have not yet moved is
  /// aborted, and nobody wins one before both people have moved.
  val invHonestResult = and {
    (playOutcome == AbortedPlay) implies (moveCount < 2),
    (playOutcome == WonPlay("alice") or playOutcome == WonPlay("bob")) implies (moveCount >= 2),
  }
  /// Bookkeeping: the matched game is bounded here to four accepted moves.
  val invAcceptedMoves = moveCount >= 0 and moveCount <= MOST_MOVES
}
