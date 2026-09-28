// Playing puzzles in a space, with a friend watching.
//
// Alice, a guest, hosts a space; Bob, another guest, joined it from its
// space link. Both have the space's game choice in view. Alice drives: from
// the game choice she opens puzzles, which puts chess's board in view. On the
// board she is solving a puzzle: she can solve it, play a wrong move (she is
// told the move was wrong), show the solution, or skip it. After a wrong
// move, a solve or a shown solution she may retry the same puzzle from the
// start. Once the puzzle is over (solved, skipped or its solution shown) she
// may move on, which puts a different puzzle on the board, and she is solving
// it; moving on twice at once still moves on just one puzzle.
//
// She can leave the puzzle for the chess choices, and step back from there to
// the space's game choice. A puzzle she left unfinished (solving, or wrong) is
// the one she finds when she goes back to the puzzles, as it was; a puzzle
// she left over is not: going back starts the next one. She can close the app
// on the board and reopen it, back in the space: the board is as she left it.
//
// Bob only watches: what the space plays belongs to the space, so his view
// follows Alice's — the same view, the same puzzle, in the same state — but
// only the host may move on, and only the host's puzzles are counted.
//
// The puzzle pool holds three puzzles. They are served in turn, never the one
// just played; once all three were played the feed comes round to the one
// played longest ago. Each first start of a puzzle uses one puzzle start of
// the guest's daily puzzle limit of 20; a puzzle served again once the pool
// is played through is unrated and uses none, and going back to a puzzle
// (after leaving it or closing the app) is no start at all. So a guest here
// uses at most three puzzle starts, and never reaches the daily puzzle limit
// — the limit itself is shown by its own examples, not by this model.
module puzzle_attempt {
  type Person = str

  /// The host, who drives the puzzle.
  pure val HOST: Person = "alice"
  /// A friend in the space, watching.
  pure val WATCHER: Person = "bob"
  pure val PEOPLE: Set[Person] = Set(HOST, WATCHER)
  /// Puzzles the pool holds.
  pure val POOL: int = 3
  /// Rated puzzle starts a guest gets per day.
  pure val GUEST_DAILY_STARTS: int = 20

  /// What a person in the space has in view.
  type View =
    | GameChoice
    | ChessChoices
    | Board

  /// What each person has in view.
  var view: Person -> View
  /// The puzzle state on each person's board, as the board says it
  /// ("solving", "wrong", "solved", "skipped", "revealed"), or "none" off
  /// the board.
  var puzzleState: Person -> str
  /// Whether each person's board offers to move on.
  var moveOnOffered: Person -> bool
  /// The puzzle on each person's board, numbered in the order it first
  /// reached a board (0, 1, 2), or -1 off the board.
  var puzzle: Person -> int
  /// Puzzle starts each person's device has used today.
  var puzzleStarts: Person -> int

  /// Bookkeeping: what Alice has in view.
  var _at: View
  /// Bookkeeping: the state of Alice's current attempt, on or off the board.
  var _attempt: str
  /// Bookkeeping: puzzles served so far (first starts and repeats).
  var _served: int

  pure def isOver(a: str): bool = Set("solved", "skipped", "revealed").contains(a)

  /// Every change goes through here, so what each person has in view always
  /// follows from what Alice has in view and the attempt she has.
  action _moveTo(newAt: View, newAttempt: str, newServed: int): bool = all {
    _at' = newAt,
    _attempt' = newAttempt,
    _served' = newServed,
    view' = PEOPLE.mapBy(_ => newAt),
    puzzleState' = PEOPLE.mapBy(_ => if (newAt == Board) newAttempt else "none"),
    moveOnOffered' = PEOPLE.mapBy(p => p == HOST and newAt == Board and isOver(newAttempt)),
    puzzle' = PEOPLE.mapBy(_ => if (newAt == Board) (newServed + POOL - 1) % POOL else -1),
    puzzleStarts' = PEOPLE.mapBy(p => if (p != HOST) 0 else if (newServed < POOL) newServed else POOL),
  }

  action init = _moveTo(GameChoice, "none", 0)

  /// Onto the board: back to the unfinished puzzle, else a fresh one.
  action _enterBoard: bool =
    if (_attempt == "solving" or _attempt == "wrong")
      _moveTo(Board, _attempt, _served)
    else
      _moveTo(Board, "solving", _served + 1)

  /// From the space's game choice: chess, then its board.
  action openPuzzles: bool = all {
    _at == GameChoice,
    _enterBoard,
  }

  /// From the chess choices back onto the board.
  action goBackToPuzzles: bool = all {
    _at == ChessChoices,
    _enterBoard,
  }

  /// Leave the puzzle for the chess choices.
  action leavePuzzle: bool = all {
    _at == Board,
    _moveTo(ChessChoices, _attempt, _served),
  }

  /// From the chess choices back to the space's game choice.
  action backToGameChoice: bool = all {
    _at == ChessChoices,
    _moveTo(GameChoice, _attempt, _served),
  }

  action solve: bool = all {
    _at == Board,
    _attempt == "solving",
    _moveTo(Board, "solved", _served),
  }

  /// A legal move that is not the solution.
  action playWrongMove: bool = all {
    _at == Board,
    _attempt == "solving",
    _moveTo(Board, "wrong", _served),
  }

  /// The rest of the line plays out, and the puzzle is over.
  action showSolution: bool = all {
    _at == Board,
    Set("solving", "wrong").contains(_attempt),
    _moveTo(Board, "revealed", _served),
  }

  /// Give up on the puzzle.
  action skip: bool = all {
    _at == Board,
    Set("solving", "wrong").contains(_attempt),
    _moveTo(Board, "skipped", _served),
  }

  /// The same puzzle again from the start.
  action retry: bool = all {
    _at == Board,
    Set("wrong", "solved", "revealed").contains(_attempt),
    _moveTo(Board, "solving", _served),
  }

  /// Move on: a different puzzle.
  action moveOn: bool = all {
    _at == Board,
    isOver(_attempt),
    _moveTo(Board, "solving", _served + 1),
  }

  /// Moving on twice at once: still just one different puzzle.
  action moveOnTwiceAtOnce: bool = all {
    _at == Board,
    isOver(_attempt),
    _moveTo(Board, "solving", _served + 1),
  }

  /// Close the app on the board, reopen it and return to the space: the
  /// board is as it was.
  action reopenApp: bool = all {
    _at == Board,
    _moveTo(Board, _attempt, _served),
  }

  action step = any {
    openPuzzles,
    goBackToPuzzles,
    leavePuzzle,
    backToGameChoice,
    solve,
    playWrongMove,
    showSolution,
    skip,
    retry,
    moveOn,
    moveOnTwiceAtOnce,
    reopenApp,
  }

  /// A guest here never uses more than the daily allowance.
  val invStartsWithinAllowance = PEOPLE.forall(p => puzzleStarts.get(p) <= GUEST_DAILY_STARTS)

  /// Moving on is offered only to the host, once the puzzle on the board is
  /// over.
  val invMoveOnOnlyWhenOver = PEOPLE.forall(p =>
    moveOnOffered.get(p) implies (p == HOST and view.get(p) == Board and isOver(puzzleState.get(p)))
  )

  /// Off the board, no puzzle and no puzzle state shows.
  val invNothingOffTheBoard = PEOPLE.forall(p =>
    (view.get(p) != Board) implies (puzzle.get(p) == -1 and puzzleState.get(p) == "none")
  )

  /// The watcher's board agrees with the host's.
  val invWatcherSeesTheHostsBoard = all {
    view.get(WATCHER) == view.get(HOST),
    puzzle.get(WATCHER) == puzzle.get(HOST),
    puzzleState.get(WATCHER) == puzzleState.get(HOST),
  }
}
