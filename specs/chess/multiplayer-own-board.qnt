// @model-profile: local
// Alice and Bob play one multiplayer game, at first Alice as White and Bob
// as Black, and Carol watches it. Each of them has their own board on their
// own device.
//
// Each of them can review any earlier position of the game on their own
// board: choose a move in the multiplayer move list, step back or forward
// one move, go to the start, or return to the current position in one step.
// While a person reviews an earlier position no piece can be moved on their
// board. A move accepted meanwhile joins the multiplayer move list and
// leaves their board on the position they chose until they return.
//
// Each of them can also flip the board to see it from the other side, and
// flip it back. A multiplayer rematch swaps the colours and starts every
// board afresh: Alice's and Bob's each from their own new side, and Carol's
// from White's side.
//
// Once the game is over with a multiplayer result, each of them can copy its
// game record or its final position. An unfinished or aborted game offers
// neither.
//
// Reviewing an earlier position, flipping the board and copying change only
// what that one person has in front of them: nobody else's board changes, no
// piece moves and the turn stays where it is. None of it needs a connection:
// each uses only what the person's own device already shows, which with no
// connection is its last known multiplayer board.
//
// The game is bounded here to four accepted moves and ends by one person
// resigning or aborting. Other endings, the multiplayer clocks, draw offers
// and how a multiplayer rematch is offered follow multiplayer chess.
module multiplayer_own_board {
  type PlayOutcome = OngoingPlay | WonPlay(str) | DrawnPlay | AbortedPlay

  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val MATCHED = Set("alice", "bob")
  pure val MOST_MOVES = 4
  pure val CURRENT = -1

  /// How many accepted moves the multiplayer move list shows to everyone.
  var moveCount: int
  /// That the game is unfinished, its multiplayer result, or that it was aborted.
  var playOutcome: PlayOutcome
  /// The colour each person plays: "White" or "Black", and "none" for the watcher.
  var playSide: str -> str
  /// The earlier position each person is reviewing, as the number of moves
  /// played to reach it, or -1 while their board shows the current position.
  var earlierPosition: str -> int
  /// The side each person's board is seen from: "White" or "Black".
  var boardFacing: str -> str
  /// Whether the game record and the final position are offered for copying.
  var gameRecordOffered: bool

  var _white: str
  var _flipped: Set[str]

  pure def _other(p: str): str = if (p == "alice") "bob" else "alice"
  pure def _otherSide(side: str): str = if (side == "White") "Black" else "White"
  pure def _side(p: str, white: str): str =
    if (p == white) "White" else if (MATCHED.contains(p)) "Black" else "none"
  /// A board is seen from its person's own side, and a watcher's from
  /// White's side, or from the other side once they have flipped it.
  pure def _facing(p: str, white: str, flipped: Set[str]): str = {
    val own = if (_side(p, white) == "Black") "Black" else "White"
    if (flipped.contains(p)) _otherSide(own) else own
  }
  pure def _hasResult(o: PlayOutcome): bool = o != OngoingPlay and o != AbortedPlay
  def _shownPosition(p: str): int =
    if (earlierPosition.get(p) == CURRENT) moveCount else earlierPosition.get(p)
  def _toMove: str = if (moveCount % 2 == 0) _white else _other(_white)

  action _show(moves: int, outcome: PlayOutcome, white: str, earlier: str -> int, flipped: Set[str]): bool = all {
    moveCount' = moves, playOutcome' = outcome, _white' = white,
    earlierPosition' = earlier, _flipped' = flipped,
    playSide' = PEOPLE.mapBy(p => _side(p, white)),
    boardFacing' = PEOPLE.mapBy(p => _facing(p, white, flipped)),
    gameRecordOffered' = _hasResult(outcome),
  }
  /// One person's board shows the position after that many moves; the
  /// position after the latest move is the current position.
  action _review(person: str, position: int): bool =
    _show(moveCount, playOutcome, _white,
      earlierPosition.set(person, if (position >= moveCount) CURRENT else position), _flipped)
  action _unchanged: bool = _show(moveCount, playOutcome, _white, earlierPosition, _flipped)

  action init = all {
    moveCount' = 0, playOutcome' = OngoingPlay, _white' = "alice",
    earlierPosition' = PEOPLE.mapBy(_ => CURRENT), _flipped' = Set(),
    playSide' = PEOPLE.mapBy(p => _side(p, "alice")),
    boardFacing' = PEOPLE.mapBy(p => _facing(p, "alice", Set())),
    gameRecordOffered' = false,
  }

  /// The person whose turn it is moves a piece, on the current position
  /// only: while they review an earlier position nothing moves. The
  /// multiplayer move list gains the move for everyone, and a board on an
  /// earlier position stays there. Bounded here to four accepted moves.
  action playMove(person: str): bool = {
    val moves = and {
      playOutcome == OngoingPlay, person == _toMove, earlierPosition.get(person) == CURRENT,
    }
    all {
      not(moves) or moveCount < MOST_MOVES,
      _show(if (moves) moveCount + 1 else moveCount, playOutcome, _white, earlierPosition, _flipped),
    }
  }

  /// Once both people have moved, either of them resigns and the other wins.
  action resignPlay(person: str): bool = all {
    playOutcome == OngoingPlay, moveCount >= 2, MATCHED.contains(person),
    _show(moveCount, WonPlay(_other(person)), _white, earlierPosition, _flipped),
  }

  /// Until both people have moved, either of them aborts the game.
  action abortPlay(person: str): bool = all {
    playOutcome == OngoingPlay, moveCount < 2, MATCHED.contains(person),
    _show(moveCount, AbortedPlay, _white, earlierPosition, _flipped),
  }

  /// One of the two people accepts a multiplayer rematch of a game that is
  /// over with a multiplayer result; an aborted game has none. The new game
  /// swaps the colours, and everyone's board shows its current position,
  /// each from its own side again.
  action acceptRematch(person: str): bool = all {
    _hasResult(playOutcome), MATCHED.contains(person),
    _show(0, OngoingPlay, _other(_white), PEOPLE.mapBy(_ => CURRENT), Set()),
  }

  /// Choosing a move in the multiplayer move list shows the position after
  /// it on the person's own board. Choosing the latest move shows the
  /// current position.
  action chooseEarlierPosition(person: str, position: int): bool = all {
    position >= 1, position <= moveCount,
    _review(person, position),
  }

  /// Stepping back shows the position one move earlier. At the start of the
  /// game there is none to step back to.
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

  /// Flipping the board shows it from the other side on that person's own
  /// device; flipping again shows it as it was.
  action flipBoard(person: str): bool =
    _show(moveCount, playOutcome, _white, earlierPosition,
      if (_flipped.contains(person)) _flipped.exclude(Set(person)) else _flipped.union(Set(person)))

  /// Copying the game record of a game that is over with a multiplayer
  /// result changes nothing on anyone's board.
  action copyGameRecord(person: str): bool = all { gameRecordOffered, _unchanged }

  /// Copying the final position of such a game changes nothing either.
  action copyFinalPosition(person: str): bool = all { gameRecordOffered, _unchanged }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet position = 1.to(MOST_MOVES).oneOf()
    any {
      playMove(person), resignPlay(person), abortPlay(person), acceptRematch(person),
      chooseEarlierPosition(person, position), stepBackOneMove(person),
      stepForwardOneMove(person), goToStart(person), returnToCurrentPosition(person),
      flipBoard(person), copyGameRecord(person), copyFinalPosition(person),
    }
  }

  /// A person only ever reviews a position the game was really in, before
  /// its current position.
  val invEarlierPositionWasPlayed = PEOPLE.forall(p => or {
    earlierPosition.get(p) == CURRENT,
    earlierPosition.get(p) >= 0 and earlierPosition.get(p) < moveCount,
  })
  /// One of the two people plays White and the other Black; the watcher
  /// plays neither.
  val invFixedColours = and {
    Set(playSide.get("alice"), playSide.get("bob")) == Set("White", "Black"),
    playSide.get("carol") == "none",
  }
  /// Each board is seen from White's or Black's side: a person's own side
  /// and a watcher's White's, or the other side once they have flipped it.
  val invBoardFacesOneSide = PEOPLE.forall(p => {
    val own = if (playSide.get(p) == "Black") "Black" else "White"
    boardFacing.get(p) == (if (_flipped.contains(p)) _otherSide(own) else own)
  })
  /// The game record and the final position are offered exactly when the
  /// game is over with a multiplayer result: never while it is unfinished,
  /// and never once it was aborted.
  val invGameRecordNeedsResult = gameRecordOffered iff or {
    playOutcome == WonPlay("alice"), playOutcome == WonPlay("bob"), playOutcome == DrawnPlay,
  }
  /// Only a game in which both people have not yet moved is aborted, and
  /// nobody wins a game before both people have moved.
  val invHonestResult = and {
    (playOutcome == AbortedPlay) implies (moveCount < 2),
    (playOutcome == WonPlay("alice") or playOutcome == WonPlay("bob")) implies (moveCount >= 2),
  }
  /// Bookkeeping: the game is bounded here to four accepted moves.
  val invAcceptedMoves = moveCount >= 0 and moveCount <= MOST_MOVES
}
