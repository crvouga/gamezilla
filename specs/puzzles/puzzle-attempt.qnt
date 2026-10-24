// Bob plays a puzzle offering undo and redo. In this example three accepted
// actions complete it. Every attempt keeps its chosen edition. Undo, a different
// continuation and restarting retain ordinary completion and earlier attempts.
// Later publication or withdrawal never changes saved play. The phone starts
// connected. Offline play survives reopening; its completion reaches Bob's
// tablet when the connection returns, once for each puzzle edition.
module puzzle_attempt {
  type Attempt = { edition: int, history: List[int], cursor: int, finished: bool }
  var attempts: List[Attempt]
  var activeAttempt: int
  var completions: Set[int]
  var otherCompletions: Set[int]
  var currentEdition: int
  var available: bool
  var keptContinuations: Set[int]
  var _online: bool
  var _previousAttempts: List[Attempt]
  var _previousCompletions: Set[int]
  var _previousContinuations: Set[int]

  pure def _fresh(edition: int): Attempt =
    { edition: edition, history: List(0), cursor: 0, finished: false }

  action _save(plays: List[Attempt], chosen: int, edition: int,
    offered: bool, online: bool, kept: Set[int]): bool = {
    val completed = plays.indices().filter(i => plays.nth(i).finished).map(i => plays.nth(i).edition)
    all {
      attempts' = plays, activeAttempt' = chosen, completions' = completed,
      otherCompletions' = (if (online) completed else otherCompletions),
      currentEdition' = edition, available' = offered, _online' = online,
      _previousAttempts' = attempts, _previousCompletions' = completions,
      keptContinuations' = kept, _previousContinuations' = keptContinuations,
    }
  }

  action _keep(plays: List[Attempt], chosen: int, edition: int,
    offered: bool, online: bool): bool =
    _save(plays, chosen, edition, offered, online, keptContinuations)

  action init = all {
    attempts' = List(), activeAttempt' = -1, completions' = Set(),
    otherCompletions' = Set(), currentEdition' = 1, available' = true,
    _online' = true, _previousAttempts' = List(), _previousCompletions' = Set(),
    keptContinuations' = Set(), _previousContinuations' = Set(),
  }

  /// Starting unavailable content is refused without losing other attempts.
  /// Three attempts bound exploration rather than imposing a product limit.
  action startPuzzle: bool = all {
    attempts.length() < 3,
    if (available)
      _keep(attempts.append(_fresh(currentEdition)), attempts.length(), currentEdition, available, _online)
    else _keep(attempts, activeAttempt, currentEdition, available, _online),
  }

  /// Accepted play replaces only the undone continuation; completion stays kept.
  action advanceAttempt: bool = all {
    attempts.indices().contains(activeAttempt),
    val attempt = attempts.nth(activeAttempt)
    val position = attempt.history.nth(attempt.cursor)
    val history = attempt.history.slice(0, attempt.cursor + 1).append(position + 1)
    all {
      position < 3,
      _keep(attempts.replaceAt(activeAttempt, { ...attempt, history: history,
        cursor: history.length() - 1, finished: (attempt.finished or position + 1 == 3) }),
        activeAttempt, currentEdition, available, _online),
    },
  }

  /// A fresh attempt has nothing to undo; other attempts move back one position.
  action undoAttempt: bool = all {
    attempts.indices().contains(activeAttempt),
    val attempt = attempts.nth(activeAttempt)
    val cursor = if (attempt.cursor > 0) attempt.cursor - 1 else attempt.cursor
    _keep(attempts.replaceAt(activeAttempt, { ...attempt, cursor: cursor }),
      activeAttempt, currentEdition, available, _online),
  }

  /// Redo is offered only while that continuation remains in the attempt's history.
  action redoAttempt: bool = all {
    attempts.indices().contains(activeAttempt),
    val attempt = attempts.nth(activeAttempt)
    val cursor = if (attempt.cursor + 1 < attempt.history.length()) attempt.cursor + 1 else attempt.cursor
    _keep(attempts.replaceAt(activeAttempt, { ...attempt, cursor: cursor }),
      activeAttempt, currentEdition, available, _online),
  }

  /// Restarting chooses the same edition and keeps earlier play and completion.
  action restartPuzzle: bool = all {
    attempts.indices().contains(activeAttempt), attempts.length() < 3,
    _keep(attempts.append(_fresh(attempts.nth(activeAttempt).edition)), attempts.length(),
      currentEdition, available, _online),
  }

  /// Returning to any earlier attempt restores its saved position and edition.
  action resumeAttempt(attempt: int): bool = all {
    attempts.indices().contains(attempt),
    _keep(attempts, attempt, currentEdition, available, _online),
  }

  /// The connected tablet continues from the attempt's earlier starting position.
  /// Its different accepted play remains a choice beside the phone's continuation.
  action continueEarlierAttempt: bool = all {
    _online, attempts.indices().contains(activeAttempt),
    val attempt = attempts.nth(activeAttempt)
    attempt.cursor > 0,
    _save(attempts, activeAttempt, currentEdition, available, _online,
      keptContinuations.union(Set(activeAttempt))),
  }

  /// Reopening never changes accepted play, including with no connection.
  action reopenApp: bool = _keep(attempts, activeAttempt, currentEdition, available, _online)

  /// Two publications bound exploration; existing attempts do not change editions.
  action publishPuzzleEdition: bool = all {
    currentEdition < 2,
    _keep(attempts, activeAttempt, currentEdition + 1, true, _online),
  }

  /// A withdrawn puzzle leaves every earlier attempt playable.
  action withdrawPuzzle: bool = _keep(attempts, activeAttempt, currentEdition, false, _online)

  /// Model-only: the phone loses its connection and retains accepted play.
  action _loseConnection: bool = all {
    _online, _keep(attempts, activeAttempt, currentEdition, available, false),
  }

  /// Kept completion becomes available on Bob's tablet when the phone returns online.
  action connectionReturns: bool = all {
    not(_online), _keep(attempts, activeAttempt, currentEdition, available, true),
  }

  action step = {
    nondet attempt = Set(0, 1, 2).oneOf()
    any { startPuzzle, advanceAttempt, undoAttempt, redoAttempt, restartPuzzle,
      resumeAttempt(attempt), continueEarlierAttempt, reopenApp, publishPuzzleEdition, withdrawPuzzle,
      _loseConnection, connectionReturns }
  }

  /// Each kept attempt has one real edition and a position in its own history.
  val invAttemptPositionsAreKept = attempts.indices().forall(i => {
    val attempt = attempts.nth(i)
    attempt.edition > 0 and attempt.edition <= currentEdition and
      attempt.history.indices().contains(attempt.cursor)
  }) and (activeAttempt == -1 or attempts.indices().contains(activeAttempt))
  /// Restart, publication and withdrawal cannot erase an earlier attempt or change its edition.
  val invEarlierAttemptsKeepTheirEdition = _previousAttempts.indices().forall(i =>
    attempts.indices().contains(i) and attempts.nth(i).edition == _previousAttempts.nth(i).edition)
  /// Completion belongs to a real completed attempt at that edition, counted once.
  val invCompletionHasAnAttempt = completions ==
    attempts.indices().filter(i => attempts.nth(i).finished).map(i => attempts.nth(i).edition)
  /// Undoing, restarting and publication never erase completion.
  val invCompletionNeverDisappears = _previousCompletions.subseteq(completions)
  val invDifferentContinuationsAreKept = keptContinuations.subseteq(attempts.indices()) and
    _previousContinuations.subseteq(keptContinuations)
  val invConnectedCompletionAgrees = _online implies otherCompletions == completions
  /// Offline completion stays on the phone until it can reach Bob's other device.
  val invOfflineCompletionIsKept = not(_online) implies otherCompletions.subseteq(completions)
  /// Availability affects new play, never the edition of saved play.
  val invWithdrawalPreservesSavedPlay = not(available) implies
    attempts.indices().forall(i => attempts.nth(i).edition <= currentEdition)
}
