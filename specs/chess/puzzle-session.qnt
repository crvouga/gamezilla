// Playing puzzles in a space, with a friend watching.
//
// Alice, a guest, hosts a space; Bob, another guest, joined it from its
// link. Both look at the space's game menu. Alice drives: from the game menu
// she opens chess and its puzzle board. On the board she is solving a
// puzzle: she can solve it, play a wrong move (she is told the move was
// wrong), show the solution, or skip it. After a wrong move, a solve or a
// shown solution she may retry the same puzzle from the start. Once the
// puzzle is over (solved, skipped or its solution shown) she is offered Next,
// which puts a different puzzle on the board, and she is solving it.
//
// She can leave the board for the chess choices, and step back from there to
// the space's game menu. A puzzle she left unfinished (solving, or wrong) is
// the one she comes back to, as it was; a puzzle she left over is not: coming
// back starts the next one.
//
// Bob only watches: what the space plays belongs to the space, so his screen
// follows Alice's — the same screen, the same puzzle, in the same state — but
// only the host is offered Next, and only the host's puzzles are counted.
//
// The puzzle pool holds three puzzles. They are served in turn, never the one
// just played; once all three were played the feed comes round to the one
// played longest ago. Each first start of a puzzle uses one unit of the
// guest's daily allowance of 20 rated puzzle starts; a puzzle served again
// once the pool is played through is unrated and uses none. So a guest here
// uses at most three starts, and never reaches the daily limit — the limit
// itself (`puzzle-quota.feature`) is out of this model's reach.
module puzzle_session {
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

  /// What a screen in the space shows.
  type Screen =
    | GameMenu
    | ChessMenu
    | Board

  /// What each person's screen shows.
  var screen: Person -> Screen
  /// The state of the puzzle on each person's board, as the board says it
  /// ("solving", "wrong", "solved", "skipped", "revealed"), or "none" off
  /// the board.
  var status: Person -> str
  /// Whether each person's board offers Next.
  var nextOffered: Person -> bool
  /// The puzzle on each person's board, numbered in the order it first
  /// reached a board (0, 1, 2), or -1 off the board.
  var puzzle: Person -> int
  /// Rated puzzle starts each person's device has used today.
  var starts: Person -> int

  /// Bookkeeping: where Alice is.
  var at: Screen
  /// Bookkeeping: the state of Alice's current attempt, on or off the board.
  var attempt: str
  /// Bookkeeping: puzzles served so far (first starts and repeats).
  var served: int

  pure def isOver(a: str): bool = Set("solved", "skipped", "revealed").contains(a)

  /// Every change goes through here, so what each screen shows always
  /// follows from where Alice is and the attempt she has.
  action moveTo(newAt: Screen, newAttempt: str, newServed: int): bool = all {
    at' = newAt,
    attempt' = newAttempt,
    served' = newServed,
    screen' = PEOPLE.mapBy(_ => newAt),
    status' = PEOPLE.mapBy(_ => if (newAt == Board) newAttempt else "none"),
    nextOffered' = PEOPLE.mapBy(p => p == HOST and newAt == Board and isOver(newAttempt)),
    puzzle' = PEOPLE.mapBy(_ => if (newAt == Board) (newServed + POOL - 1) % POOL else -1),
    starts' = PEOPLE.mapBy(p => if (p != HOST) 0 else if (newServed < POOL) newServed else POOL),
  }

  action init = moveTo(GameMenu, "none", 0)

  /// Onto the board: back to the unfinished puzzle, else a fresh one.
  action enterBoard: bool =
    if (attempt == "solving" or attempt == "wrong")
      moveTo(Board, attempt, served)
    else
      moveTo(Board, "solving", served + 1)

  /// From the space's game menu: chess, then its puzzle board.
  action openBoard: bool = all {
    at == GameMenu,
    enterBoard,
  }

  /// From the chess choices back onto the puzzle board.
  action reopenBoard: bool = all {
    at == ChessMenu,
    enterBoard,
  }

  /// Leave the board for the chess choices.
  action leaveBoard: bool = all {
    at == Board,
    moveTo(ChessMenu, attempt, served),
  }

  /// From the chess choices back to the space's game menu.
  action backToGameMenu: bool = all {
    at == ChessMenu,
    moveTo(GameMenu, attempt, served),
  }

  action solve: bool = all {
    at == Board,
    attempt == "solving",
    moveTo(Board, "solved", served),
  }

  /// A legal move that is not the solution.
  action playWrongMove: bool = all {
    at == Board,
    attempt == "solving",
    moveTo(Board, "wrong", served),
  }

  /// The rest of the line plays out, and the puzzle is over.
  action showSolution: bool = all {
    at == Board,
    Set("solving", "wrong").contains(attempt),
    moveTo(Board, "revealed", served),
  }

  /// Give up on the puzzle.
  action skip: bool = all {
    at == Board,
    Set("solving", "wrong").contains(attempt),
    moveTo(Board, "skipped", served),
  }

  /// The same puzzle again from the start.
  action retry: bool = all {
    at == Board,
    Set("wrong", "solved", "revealed").contains(attempt),
    moveTo(Board, "solving", served),
  }

  /// Next: a different puzzle.
  action moveOn: bool = all {
    at == Board,
    isOver(attempt),
    moveTo(Board, "solving", served + 1),
  }

  action step = any {
    openBoard,
    reopenBoard,
    leaveBoard,
    backToGameMenu,
    solve,
    playWrongMove,
    showSolution,
    skip,
    retry,
    moveOn,
  }

  /// A guest here never uses more than the daily allowance.
  val invStartsWithinAllowance = PEOPLE.forall(p => starts.get(p) <= GUEST_DAILY_STARTS)

  /// Next is offered only to the host, once the puzzle on the board is over.
  val invNextOnlyWhenOver = PEOPLE.forall(p =>
    nextOffered.get(p) implies (p == HOST and screen.get(p) == Board and isOver(status.get(p)))
  )

  /// Off the board, no puzzle and no status shows.
  val invNothingOffTheBoard = PEOPLE.forall(p =>
    (screen.get(p) != Board) implies (puzzle.get(p) == -1 and status.get(p) == "none")
  )

  /// The watcher's board agrees with the host's.
  val invWatcherSeesTheHostsBoard = all {
    screen.get(WATCHER) == screen.get(HOST),
    puzzle.get(WATCHER) == puzzle.get(HOST),
    status.get(WATCHER) == status.get(HOST),
  }
}
