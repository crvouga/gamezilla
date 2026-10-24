// Alice arranges a pack, publishes its order and withdraws discovery. Each
// published pack chooses particular puzzle editions. Later puzzle publication,
// withdrawal or pack editing never changes an earlier pack edition. Bob cannot
// publish or withdraw Alice's pack. Empty packs and unavailable puzzles cannot
// be published. The phone starts connected; offline pack edits stay on it after
// reopening, then reach Alice's tablet when its connection returns.
module pack_publication {
  type Reference = { puzzle: int, edition: int }
  pure val PEOPLE = Set("Alice", "Bob")
  pure val ORDERS = Set(List(), List(0), List(1), List(0, 1), List(1, 0))

  var drafts: List[List[Reference]]
  var workingDraft: int
  var otherDraft: int
  var editions: int -> List[Reference]
  var currentEdition: int
  var discoveredEdition: int
  var puzzleEditions: int -> int
  var availablePuzzles: Set[int]
  var _online: bool
  var _previousEditions: int -> List[Reference]

  action _keep(copies: List[List[Reference]], chosen: int, published: int -> List[Reference],
    current: int, puzzles: int -> int, available: Set[int], online: bool): bool = all {
    drafts' = copies, workingDraft' = chosen,
    otherDraft' = (if (not(online)) otherDraft else chosen),
    editions' = published, currentEdition' = current,
    discoveredEdition' = (if (not(online)) discoveredEdition else current),
    puzzleEditions' = puzzles, availablePuzzles' = available,
    _online' = online, _previousEditions' = editions,
  }

  action init = all {
    drafts' = List(List({ puzzle: 0, edition: 1 }, { puzzle: 1, edition: 0 })),
    workingDraft' = 0, otherDraft' = 0,
    editions' = Map(), currentEdition' = -1, discoveredEdition' = -1,
    puzzleEditions' = Map(0 -> 1, 1 -> 0), availablePuzzles' = Set(0),
    _online' = true, _previousEditions' = Map(),
  }

  /// Reordering keeps each chosen edition. Adding a puzzle chooses its current
  /// published edition. An unpublished puzzle waits for its first publication.
  def _reference(puzzle: int): Reference = {
    val chosen = drafts.nth(workingDraft)
    if (chosen.length() > 0 and chosen.nth(0).puzzle == puzzle) chosen.nth(0)
    else if (chosen.length() > 1 and chosen.nth(1).puzzle == puzzle) chosen.nth(1)
    else { puzzle: puzzle, edition: puzzleEditions.get(puzzle) }
  }

  /// Alice saves a complete pack order privately; four copies bound exploration.
  action savePackDraft(order: List[int]): bool = all {
    ORDERS.contains(order), drafts.length() < 4,
    val chosen = order.foldl(List(), (refs, p) => refs.append(_reference(p)))
    _keep(drafts.append(chosen), drafts.length(), editions, currentEdition,
      puzzleEditions, availablePuzzles, _online),
  }

  /// Only the author publishes a nonempty pack of available published puzzles.
  /// Publishing the same draft again never replaces a later choice or withdrawal.
  action publishPack(person: str, draft: int): bool = all {
    PEOPLE.contains(person), drafts.indices().contains(draft),
    draft == workingDraft or editions.keys().contains(draft),
    if (person == "Alice" and drafts.nth(draft).length() > 0 and
      drafts.nth(draft).indices().forall(i => availablePuzzles.contains(drafts.nth(draft).nth(i).puzzle)) and
      not(editions.keys().contains(draft)))
      _keep(drafts, workingDraft, editions.put(draft, drafts.nth(draft).foldl(List(), (refs, r) =>
        refs.append({ puzzle: r.puzzle,
          edition: (if (r.edition == 0) puzzleEditions.get(r.puzzle) else r.edition) }))), draft,
        puzzleEditions, availablePuzzles, _online)
    else _keep(drafts, workingDraft, editions, currentEdition,
      puzzleEditions, availablePuzzles, _online),
  }

  /// Only Alice withdraws her pack; its earlier editions remain available.
  action withdrawPack(person: str): bool = all {
    PEOPLE.contains(person),
    _keep(drafts, workingDraft, editions, if (person == "Alice") -1 else currentEdition,
      puzzleEditions, availablePuzzles, _online),
  }

  /// A puzzle may gain a new public edition without changing a published pack.
  /// Two editions of each puzzle bound exploration, not the product.
  action publishPackPuzzle(puzzle: int): bool = all {
    puzzleEditions.keys().contains(puzzle), puzzleEditions.get(puzzle) < 2,
    _keep(drafts, workingDraft, editions, currentEdition,
      puzzleEditions.set(puzzle, puzzleEditions.get(puzzle) + 1),
      availablePuzzles.union(Set(puzzle)), _online),
  }

  /// Withdrawal stops a puzzle entering a new pack publication, while old packs keep it.
  action withdrawPackPuzzle(puzzle: int): bool = all {
    puzzleEditions.keys().contains(puzzle),
    _keep(drafts, workingDraft, editions, currentEdition, puzzleEditions,
      availablePuzzles.exclude(Set(puzzle)), _online),
  }

  /// Reopening keeps the private order, also without a connection.
  action reopenApp: bool = _keep(drafts, workingDraft, editions, currentEdition,
    puzzleEditions, availablePuzzles, _online)

  /// Model-only: the phone loses its connection and keeps all accepted pack work.
  action _loseConnection: bool = all {
    _online, _keep(drafts, workingDraft, editions, currentEdition,
      puzzleEditions, availablePuzzles, false),
  }

  /// The kept pack order reaches Alice's tablet when the phone returns online.
  action connectionReturns: bool = all {
    not(_online), _keep(drafts, workingDraft, editions, currentEdition,
      puzzleEditions, availablePuzzles, true),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet order = ORDERS.oneOf()
    nondet draft = drafts.indices().oneOf()
    nondet puzzle = Set(0, 1).oneOf()
    any { savePackDraft(order), publishPack(person, draft), withdrawPack(person),
      publishPackPuzzle(puzzle), withdrawPackPuzzle(puzzle), reopenApp,
      _loseConnection, connectionReturns }
  }

  /// A published pack contains distinct puzzles with real, already published editions.
  val invPackReferencesPublishedEditions = editions.keys().forall(e =>
    editions.get(e).length() > 0 and
    editions.get(e).indices().forall(i => editions.get(e).indices().forall(j =>
      i == j or editions.get(e).nth(i).puzzle != editions.get(e).nth(j).puzzle)) and
    editions.get(e).indices().forall(i => {
      val r = editions.get(e).nth(i)
      r.edition > 0 and r.edition <= puzzleEditions.get(r.puzzle)
    }))
  /// Neither pack edits nor puzzle publication or withdrawal change an earlier pack.
  val invPackEditionsNeverChange = _previousEditions.keys().forall(e =>
    editions.keys().contains(e) and editions.get(e) == _previousEditions.get(e))
  val invDiscoveryChoosesAnEdition = Set(currentEdition, discoveredEdition).forall(e =>
    e == -1 or editions.keys().contains(e))
  /// A withdrawn puzzle may still be played in an earlier published pack.
  val invWithdrawalKeepsEarlierReferences = availablePuzzles.forall(p => puzzleEditions.get(p) > 0)
  val invConnectedDevicesAgree = _online implies
    (workingDraft == otherDraft and currentEdition == discoveredEdition)
  /// Every offline order stays available to its author after reopening.
  val invOfflineWorkIsKept = not(_online) implies
    (drafts.indices().contains(workingDraft) and drafts.indices().contains(otherDraft))
}
