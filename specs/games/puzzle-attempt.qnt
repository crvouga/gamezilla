// Playing puzzles of the game in a space, with a friend watching. It holds
// for every game that offers puzzles, and runs once for each of them.
//
// Alice, a guest, hosts a space; Bob, another guest, joined it from its
// space link. Both have the space's game choice in view. Alice drives: from
// the game choice she opens puzzles, which puts the game's board in view. On the
// board she is solving a puzzle: she can solve it, play a wrong move (she is
// told the move was wrong), show the solution, or skip it. After a wrong
// move, a solve or a shown solution she may retry the same puzzle from the
// start. Once the puzzle is over (solved, skipped or its solution shown) she
// may move on, which puts a different puzzle on the board, and she is solving
// it; moving on twice at once still moves on just one puzzle.
//
// She can leave the puzzle for the game's choices, and step back from there to
// the space's game choice. A puzzle she left unfinished (solving, or wrong) is
// the one she finds when she goes back to the puzzles, as it was; a puzzle
// she left over is not: going back starts the next one. She can close the app
// on the board and reopen it, back in the space: the board is as she left it.
//
// Bob only watches: what the space plays belongs to the space, so his view
// follows Alice's — the same view, the same puzzle, in the same state — but
// only the host may move on, and only the host's puzzles are counted.
//
// While a device has no connection, Alice still plays a puzzle already on it,
// and her own board changes at once. Bob keeps the last view they shared and
// does not follow those changes while Alice is offline. Once both are online
// he sees Alice's position. Opening puzzles before any have reached the
// device needs a connection.
//
// The puzzle pool holds three puzzles, each with two solver moves. They are served in turn, never the one
// just played; once all three were played the feed comes round to the one
// played longest ago. Each first start of a puzzle uses one puzzle start of
// the guest's daily puzzle limit of 20; a puzzle served again once the pool
// is played through is unrated and uses none, and going back to a puzzle
// (after leaving it or closing the app) is no start at all. So a guest here
// uses at most three puzzle starts, and never reaches the daily puzzle limit
// — the limit itself is shown by its own examples, not by this model.
module puzzle_attempt {
  /// The known puzzle has two solver moves. With an opponent, the start,
  /// correct continuation and end are moves 1, 3 and 4 of the line.
  /// Without an opponent they are positions 0, 1 and 2: zero is before any move.
  const OPPONENT: bool
  pure val OPENING: int = if (OPPONENT) 1 else 0
  pure val CONTINUATION: int = if (OPPONENT) 3 else 1
  pure val END: int = if (OPPONENT) 4 else 2

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
    | GameChoices
    | Board
    | Elsewhere

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

  /// The move of the line the host is examining, or zero away from the board.
  var position: int
  /// Help visible to the host: none, highlight, or solution.
  var help: str
  /// Bookkeeping: the furthest move reached in the two-move puzzle.
  var _stage: int
  /// Bookkeeping: help offered at the current position, zero to two.
  var _help: int
  /// Bookkeeping: the move being examined, retained when leaving.
  var _shown: int

  /// Bookkeeping: what Alice has in view.
  var _at: View
  /// Bookkeeping: the state of Alice's current attempt, on or off the board.
  var _attempt: str
  /// Bookkeeping: puzzles served so far (first starts and repeats).
  var _served: int
  /// Whose device has no connection.
  var _offline: Set[Person]
  /// What the watcher had in view when a connection went.
  var _watcherViewAtCutOff: View
  var _watcherStateAtCutOff: str
  var _watcherPuzzleAtCutOff: int

  /// After the first pass, three positions suffice to count feed turns forever.
  pure def _nextServed(served: int): int = if (served == 6) 4 else served + 1

  pure def isOver(a: str): bool = Set("solved", "skipped", "revealed").contains(a)

  pure def _hostState(at: View, attempt: str): str =
    if (at == Board) attempt else "none"

  pure def _hostPuzzle(at: View, served: int): int =
    if (at == Board) (served + POOL - 1) % POOL else -1

  pure def _hostStarts(served: int): int =
    if (served < POOL) served else POOL

  /// Every change goes through here. While anyone's device has no
  /// connection, the watcher's view stays what it was; otherwise it follows
  /// the host.
  action _show(
    newAt: View,
    newAttempt: str,
    newServed: int,
    newOffline: Set[Person],
    watcherView: View,
    watcherState: str,
    watcherPuzzle: int,
    cutOffView: View,
    cutOffState: str,
    cutOffPuzzle: int,
    stage: int, hints: int, shown: int,
  ): bool = all {
    _stage' = stage, _help' = hints, _shown' = shown,
    position' = if (newAt == Board) shown else 0,
    help' = if (newAt != Board) "none" else if (newAttempt == "revealed") "solution"
      else if (hints == 1) "highlight" else if (hints == 2) "solution" else "none",
    _at' = newAt,
    _attempt' = newAttempt,
    _served' = newServed,
    _offline' = newOffline,
    _watcherViewAtCutOff' = cutOffView,
    _watcherStateAtCutOff' = cutOffState,
    _watcherPuzzleAtCutOff' = cutOffPuzzle,
    view' = PEOPLE.mapBy(p => if (p == HOST) newAt else watcherView),
    puzzleState' = PEOPLE.mapBy(p =>
      if (p == HOST) _hostState(newAt, newAttempt) else watcherState
    ),
    moveOnOffered' = PEOPLE.mapBy(p =>
      p == HOST and newAt == Board and isOver(newAttempt)
    ),
    puzzle' = PEOPLE.mapBy(p =>
      if (p == HOST) _hostPuzzle(newAt, newServed) else watcherPuzzle
    ),
    puzzleStarts' = PEOPLE.mapBy(p => if (p != HOST) 0 else _hostStarts(newServed)),
  }

  /// The host's board moves now. The watcher follows only while every device
  /// has a connection.
  action _followPosition(newAt: View, newAttempt: str, newServed: int,
    stage: int, hints: int, shown: int): bool =
    if (_offline == Set())
      _show(
        newAt, newAttempt, newServed, _offline,
        newAt, _hostState(newAt, newAttempt), _hostPuzzle(newAt, newServed),
        newAt, _hostState(newAt, newAttempt), _hostPuzzle(newAt, newServed),
        stage, hints, shown,
      )
    else
      _show(
        newAt, newAttempt, newServed, _offline,
        view.get(WATCHER), puzzleState.get(WATCHER), puzzle.get(WATCHER),
        _watcherViewAtCutOff, _watcherStateAtCutOff, _watcherPuzzleAtCutOff,
        stage, hints, shown,
      )

  /// New puzzles and practice after finishing start before the first solver move.
  /// A wrong move was never applied, so retry keeps the reached position.
  action _follow(newAt: View, newAttempt: str, newServed: int): bool = {
    val restart = newServed != _served or (newAttempt == "solving" and
      _attempt != "solving" and _attempt != "wrong")
    val finished = newAttempt != _attempt and Set("solved", "revealed").contains(newAttempt)
    val stage = if (restart) OPENING else if (finished) END else _stage
    val changed = restart or newAttempt != _attempt
    _followPosition(newAt, newAttempt, newServed, stage,
      if (changed) 0 else _help, if (restart or finished) stage else _shown)
  }

  action init = all {
    _at' = GameChoice, _attempt' = "none", _served' = 0, _offline' = Set(),
    _watcherViewAtCutOff' = GameChoice, _watcherStateAtCutOff' = "none",
    _watcherPuzzleAtCutOff' = -1, _stage' = 0, _help' = 0, _shown' = 0,
    position' = 0, help' = "none",
    view' = PEOPLE.mapBy(_ => GameChoice), puzzleState' = PEOPLE.mapBy(_ => "none"),
    puzzle' = PEOPLE.mapBy(_ => -1), puzzleStarts' = PEOPLE.mapBy(_ => 0),
    moveOnOffered' = PEOPLE.mapBy(_ => false),
  }

  /// Onto the board: back to the unfinished puzzle, else a fresh one.
  action _enterBoard: bool =
    if (_attempt == "solving" or _attempt == "wrong")
      _follow(Board, _attempt, _served)
    else
      _follow(Board, "solving", _nextServed(_served))

  /// From the space's game choice: the game, then its board. Before any puzzle
  /// has reached the device, this needs a connection.
  action openPuzzles: bool = all {
    _at == GameChoice,
    not(_offline.contains(HOST)) or _served > 0,
    _enterBoard,
  }

  /// From the game's choices back onto the board.
  action goBackToPuzzles: bool = all {
    _at == GameChoices,
    _enterBoard,
  }

  /// Leave the puzzle for the game's choices.
  action leavePuzzle: bool = all {
    _at == Board,
    _follow(GameChoices, _attempt, _served),
  }

  /// From the game's choices back to the space's game choice.
  action backToGameChoice: bool = all {
    _at == GameChoices,
    _follow(GameChoice, _attempt, _served),
  }

  action solve: bool = all {
    _at == Board,
    _attempt == "solving", _shown == _stage,
    _follow(Board, "solved", _served),
  }

  /// A legal move that is not the solution.
  action playWrongMove: bool = all {
    _at == Board,
    _attempt == "solving", _shown == _stage,
    _followPosition(Board, "wrong", _served, _stage, 0, _shown)
  }

  /// A correct first solver move, and any reply, reaches the next solver move.
  action playCorrectContinuation: bool = all {
    _at == Board, _attempt == "solving", _stage == OPENING, _shown == OPENING,
    _followPosition(Board, "solving", _served, CONTINUATION, 0, CONTINUATION),
  }

  /// The first hint highlights the piece to move.
  action requestHint: bool = all {
    _at == Board, _attempt == "solving", _shown == _stage, _help == 0,
    _followPosition(Board, _attempt, _served, _stage, 1, _shown),
  }

  /// The next hint shows the move without finishing the puzzle.
  action revealSolutionMove: bool = all {
    _at == Board, _attempt == "solving", _shown == _stage, _help == 1,
    _followPosition(Board, _attempt, _served, _stage, 2, _shown),
  }

  /// Examine an earlier reached position without reopening a finished puzzle.
  action stepBackPosition: bool = all {
    _at == Board, Set("solving", "solved", "revealed").contains(_attempt), _shown > OPENING,
    _followPosition(Board, _attempt, _served, _stage, 0, _shown - 1),
  }

  /// Return toward the current move, without going beyond the reached line.
  action stepForwardPosition: bool = all {
    _at == Board, Set("solving", "solved", "revealed").contains(_attempt), _shown < _stage,
    _followPosition(Board, _attempt, _served, _stage, 0, _shown + 1),
  }

  /// The rest of the line plays out, and the puzzle is over.
  action showSolution: bool = all {
    _at == Board,
    Set("solving", "wrong").contains(_attempt), _shown == _stage,
    _follow(Board, "revealed", _served),
  }

  /// Give up on the puzzle.
  action skip: bool = all {
    _at == Board,
    Set("solving", "wrong").contains(_attempt),
    _follow(Board, "skipped", _served),
  }

  /// The same puzzle again from the start.
  action retry: bool = all {
    _at == Board,
    Set("wrong", "solved", "revealed", "skipped").contains(_attempt),
    _follow(Board, "solving", _served),
  }

  /// Move on: a different puzzle.
  action moveOn: bool = all {
    _at == Board,
    isOver(_attempt),
    _follow(Board, "solving", _nextServed(_served)),
  }

  /// Moving on twice at once: still just one different puzzle.
  action moveOnTwiceAtOnce: bool = all {
    _at == Board,
    isOver(_attempt),
    _follow(Board, "solving", _nextServed(_served)),
  }

  /// A finished puzzle cannot accept another candidate move.
  action tryMoveAfterFinish: bool = all {
    _at == Board, isOver(_attempt), _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Asking for help after finishing cannot reopen or alter the puzzle.
  action tryHintAfterFinish: bool = all {
    _at == Board, isOver(_attempt), _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Showing the whole solution again cannot replace a finished result.
  action tryShowSolutionAfterFinish: bool = all {
    _at == Board, isOver(_attempt), _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Skipping again cannot replace a finished result.
  action trySkipAfterFinish: bool = all {
    _at == Board, isOver(_attempt), _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// An earlier position cannot accept another candidate move.
  action tryMoveFromReview: bool = all {
    _at == Board, _attempt == "solving", _shown < _stage, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Help concerns the current solving position, never an earlier position.
  action tryHintFromReview: bool = all {
    _at == Board, _attempt == "solving", _shown < _stage, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// The whole solution is unavailable while reviewing an earlier position.
  action tryShowSolutionFromReview: bool = all {
    _at == Board, _attempt == "solving", _shown < _stage, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// After a wrong move, retry is required before requesting help.
  action tryHintBeforeRetry: bool = all {
    _at == Board, _attempt == "wrong", _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// A wrong move must be retried before another candidate can be played.
  action tryMoveBeforeRetry: bool = all {
    _at == Board, _attempt == "wrong", _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Retry is not offered before a wrong move or a result.
  action tryRetryWhileSolving: bool = all {
    _at == Board, _attempt == "solving",
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// The solution move cannot bypass the first hint.
  action trySolutionBeforeHint: bool = all {
    _at == Board, _attempt == "solving", _shown == _stage, _help == 0, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }


  /// An illegal candidate changes neither the position nor its observation.
  action tryIllegalMove: bool = all {
    _at == Board, _attempt == "solving", _shown == _stage, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Help cannot repeat its first stage or replace a later stage with it.
  action tryEarlierHint: bool = all {
    _at == Board, _attempt == "solving", _shown == _stage, _help > 0, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Wrong and skipped boards require a retry before reviewing positions.
  action tryReviewBeforeRetry: bool = all {
    _at == Board, Set("wrong", "skipped").contains(_attempt), _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// A suggestion marks a possible move without changing play.
  action suggestMove: bool = all {
    _at == Board, _attempt == "solving", _shown == _stage, _offline == Set(),
    _followPosition(_at, _attempt, _served, _stage, _help, _shown),
  }

  /// Choose a reached position directly; choosing the current one changes nothing.
  action chooseReviewPosition(move: int): bool = all {
    _at == Board, Set("solving", "solved", "revealed").contains(_attempt),
    OPENING <= move, move <= _stage,
    _followPosition(_at, _attempt, _served, _stage,
      if (move == _shown) _help else 0, move),
  }

  /// Time passing keeps the same board; the clock has its own examples.
  action timePasses: bool =
    _followPosition(_at, _attempt, _served, _stage, _help, _shown)

  /// Close the app on the board, reopen it and return to the space: the
  /// board is as it was.
  action reopenApp: bool = all {
    _at == Board,
    _follow(Board, _attempt, _served),
  }

  /// `person`'s device loses its connection. The watcher's board stays.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _show(
      _at, _attempt, _served,
      _offline.union(Set(person)),
      view.get(WATCHER), puzzleState.get(WATCHER), puzzle.get(WATCHER),
      if (_offline == Set()) view.get(WATCHER) else _watcherViewAtCutOff,
      if (_offline == Set()) puzzleState.get(WATCHER) else _watcherStateAtCutOff,
      if (_offline == Set()) puzzle.get(WATCHER) else _watcherPuzzleAtCutOff,
      _stage, _help, _shown,
    ),
  }

  /// Every connection comes back, and the watcher sees the host's position.
  action connectionReturns: bool = all {
    _offline != Set(),
    _show(
      _at, _attempt, _served, Set(),
      _at, _hostState(_at, _attempt), _hostPuzzle(_at, _served),
      _at, _hostState(_at, _attempt), _hostPuzzle(_at, _served),
      _stage, _help, _shown,
    ),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet move = OPENING.to(END).oneOf()
    any {
      openPuzzles,
      goBackToPuzzles,
      leavePuzzle,
      backToGameChoice,
      solve,
      playWrongMove,
      playCorrectContinuation, requestHint, revealSolutionMove,
      stepBackPosition, stepForwardPosition,
      showSolution,
      skip,
      retry,
      moveOn,
      moveOnTwiceAtOnce,
      tryMoveAfterFinish, tryHintAfterFinish, tryShowSolutionAfterFinish, trySkipAfterFinish,
      tryMoveFromReview, tryHintFromReview, tryShowSolutionFromReview, tryHintBeforeRetry, tryMoveBeforeRetry,
      tryRetryWhileSolving, trySolutionBeforeHint,
      tryIllegalMove, tryEarlierHint, tryReviewBeforeRetry, suggestMove, chooseReviewPosition(move),
      reopenApp, timePasses,
      any { _loseConnection(person), connectionReturns },
    }
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

  /// While every device has a connection, the watcher's board agrees with
  /// the host's.
  val invWatcherSeesTheHostsBoard =
    (_offline == Set()) implies (
      view.get(WATCHER) == view.get(HOST) and
      puzzle.get(WATCHER) == puzzle.get(HOST) and
      puzzleState.get(WATCHER) == puzzleState.get(HOST)
    )

  /// While the watcher is offline, their last known board stays.
  val invOfflineWatcherKeepsTheBoard =
    (_offline.contains(WATCHER) and not(_offline.contains(HOST))) implies (
      view.get(WATCHER) == _watcherViewAtCutOff and
      puzzleState.get(WATCHER) == _watcherStateAtCutOff and
      puzzle.get(WATCHER) == _watcherPuzzleAtCutOff
    )

  /// While the host is offline, an online watcher keeps the last view they shared.
  val invWatcherFollowsHostAvailability =
    (_offline.contains(HOST) and not(_offline.contains(WATCHER))) implies (
      view.get(WATCHER) == _watcherViewAtCutOff and
      puzzle.get(WATCHER) == _watcherPuzzleAtCutOff and
      puzzleState.get(WATCHER) == _watcherStateAtCutOff
    )
  /// Examining a position cannot go beyond the moves reached on that puzzle.
  val invOnlyReachedPositions = position == (if (_at == Board) _shown else 0) and
    _shown <= _stage and _shown >= 0 and _stage <= END

  /// Help belongs to the board being examined; off the board it is absent.
  val invHelpBelongsToPosition = Set("none", "highlight", "solution").contains(help) and
    (_at != Board implies help == "none") and
    (_at == Board and _help > 0 and _shown == _stage and _attempt == "solving"
      implies help == (if (_help == 1) "highlight" else "solution"))

  /// A solved puzzle stays solved while its earlier positions are examined.
  val invSolvedReviewCannotReactivate =
    (_at == Board and _attempt == "solved") implies puzzleState.get(HOST) == "solved"

  val _state = (view, puzzleState, moveOnOffered, puzzle, puzzleStarts,
    position, help,
    _at, _attempt, _served, _offline, _watcherViewAtCutOff,
    _watcherStateAtCutOff, _watcherPuzzleAtCutOff, _stage, _help, _shown)
  temporal _bothReturn = eventually(always(_offline == Set()))
  /// A returning watcher eventually follows the puzzle the host is in.
  temporal liveReturningWatcherFollows = _bothReturn.implies(eventually(always(
    puzzle.get(WATCHER) == puzzle.get(HOST) and
    puzzleState.get(WATCHER) == puzzleState.get(HOST) and view.get(WATCHER) == view.get(HOST))))

}
