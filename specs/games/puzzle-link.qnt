// Alice shares a puzzle link to the puzzle of the game on her board; Bob, a
// guest, opens it on his device, and it opens that puzzle in its game. It
// holds for every game that offers puzzles, and runs once for each of them.
// Bob may or may not have played that puzzle before, and has started 18, 19
// or 20 rated puzzles today, in any game offering puzzles. Either device can
// lose its connection and get it back, more than once, while the other keeps
// its own. Alice can share the link with or without a connection.
//
// Opening the link puts that exact puzzle on Bob's board. If Bob has never
// played it, the attempt is rated and uses one puzzle start of his daily
// puzzle limit of 20, the one allowance every game offering puzzles shares;
// if he has, it is unrated and uses none. A guest who has reached the daily
// puzzle limit cannot open a puzzle he has never played: he is told the
// limit is reached. Opening the link again while the puzzle is on his board
// changes nothing and uses no further puzzle start.
//
// Once the puzzle is retired, its link no longer opens it, and Bob is told
// the puzzle is no longer available; a puzzle already on his board stays.
//
// Sharing the link again shares the same link.
//
// With no connection, opening the link puts nothing on Bob's board and he
// is told puzzles need a connection. Once he is back online, opening the
// link works again.
module puzzle_link {
  type Device = str
  /// Rated puzzles a guest may start in a day.
  pure val DAILY_PUZZLE_LIMIT: int = 20
  pure val SHARER: Device = "alice"
  pure val OPENER: Device = "bob"
  pure val DEVICES: Set[Device] = Set(SHARER, OPENER)

  /// "linked" while the linked puzzle is on Bob's board, otherwise "none".
  var puzzle: str
  /// Whether Bob's attempt at the linked puzzle is rated.
  var rated: bool
  /// Puzzle starts Bob has used today.
  var puzzleStarts: int
  /// Whether Alice has shared the puzzle link.
  var linkShared: bool
  /// What Bob is told when opening the link did not put the puzzle on his
  /// board: "none", "daily puzzle limit reached", "puzzle no longer
  /// available", or "puzzles need a connection".
  var linkRefusal: str
  /// Bookkeeping: whether Bob had played the puzzle before the link.
  var _playedBefore: bool
  /// Bookkeeping: whether the puzzle has been retired.
  var _retired: bool
  /// Bookkeeping: whose device has no connection.
  var _offline: Set[Device]

  action _show(board: str, isRated: bool, starts: int, shared: bool,
    refusal: str, retired: bool, offline: Set[Device]): bool = all {
    puzzle' = board, rated' = isRated, puzzleStarts' = starts,
    linkShared' = shared, linkRefusal' = refusal,
    _playedBefore' = _playedBefore, _retired' = retired, _offline' = offline,
  }

  action init = {
    nondet starts = 18.to(DAILY_PUZZLE_LIMIT).oneOf()
    nondet playedBefore = Set(true, false).oneOf()
    all {
      puzzle' = "none", rated' = false, puzzleStarts' = starts,
      linkShared' = false, linkRefusal' = "none",
      _playedBefore' = playedBefore, _retired' = false, _offline' = Set(),
    }
  }

  /// Alice shares a puzzle link to the puzzle on her board; sharing again
  /// shares the same link.
  action sharePuzzleLink: bool =
    _show(puzzle, rated, puzzleStarts, true, linkRefusal, _retired, _offline)

  /// Bob opens Alice's puzzle link.
  action openPuzzleLink: bool = all {
    linkShared,
    if (puzzle == "linked")
      _show(puzzle, rated, puzzleStarts, linkShared, "none", _retired, _offline)
    else if (_offline.contains(OPENER))
      _show("none", false, puzzleStarts, linkShared, "puzzles need a connection", _retired, _offline)
    else if (_retired)
      _show("none", false, puzzleStarts, linkShared, "puzzle no longer available", _retired, _offline)
    else if (_playedBefore)
      _show("linked", false, puzzleStarts, linkShared, "none", _retired, _offline)
    else if (puzzleStarts >= DAILY_PUZZLE_LIMIT)
      _show("none", false, puzzleStarts, linkShared, "daily puzzle limit reached", _retired, _offline)
    else
      _show("linked", true, puzzleStarts + 1, linkShared, "none", _retired, _offline),
  }

  /// The team retires the puzzle; it is never served again. Nobody sees this
  /// by itself: it shows only when someone opens the link afterwards.
  action retirePuzzle: bool = all {
    not(_retired),
    _show(puzzle, rated, puzzleStarts, linkShared, linkRefusal, true, _offline),
  }

  /// One device loses its connection.
  action _loseConnection(device: Device): bool = all {
    not(_offline.contains(device)),
    _show(puzzle, rated, puzzleStarts, linkShared, linkRefusal, _retired,
      _offline.union(Set(device))),
  }

  /// One device is back online. Nobody sees this by itself: Bob's next
  /// opening of the link shows it.
  action connectionReturns(device: Device): bool = all {
    _offline.contains(device),
    _show(puzzle, rated, puzzleStarts, linkShared, linkRefusal, _retired,
      _offline.exclude(Set(device))),
  }

  action _wait: bool =
    _show(puzzle, rated, puzzleStarts, linkShared, linkRefusal, _retired, _offline)

  action step = {
    nondet device = DEVICES.oneOf()
    any {
      sharePuzzleLink, openPuzzleLink, retirePuzzle,
      _loseConnection(device), connectionReturns(device), _wait,
    }
  }

  /// Only a puzzle someone shared can be opened from its puzzle link.
  val invOnlySharedPuzzleOpens = (puzzle == "linked") implies linkShared
  /// The linked attempt is rated exactly when it is Bob's first attempt.
  val invRatedOnlyOnFirstAttempt = rated == (puzzle == "linked" and not(_playedBefore))
  /// A guest never uses more than the daily puzzle limit.
  val invStartsWithinAllowance = puzzleStarts <= DAILY_PUZZLE_LIMIT
  /// Whatever Bob is told, the puzzle did not open.
  val invRefusalOpensNothing = Set("none", "daily puzzle limit reached",
    "puzzle no longer available", "puzzles need a connection").contains(linkRefusal) and
    Set("none", "linked").contains(puzzle) and
    (linkRefusal != "none" implies puzzle == "none")
  /// A retired puzzle's link never opens it.
  val invRetiredLinkNeverOpens =
    (linkRefusal == "puzzle no longer available") implies _retired
  /// While Bob's device is offline, a link he opens puts nothing new on his
  /// board: he is told puzzles need a connection.
  val invOfflineOpensNothing =
    (_offline.contains(OPENER) and linkRefusal == "puzzles need a connection") implies
      puzzle == "none"
}
