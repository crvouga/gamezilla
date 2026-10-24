// Alice creates a private pack with a title and description. She adds puzzles
// of its game once each, removes them and changes their order. A new private
// puzzle created from the pack is included immediately. Bob cannot discover
// this private work. The phone starts connected; offline edits survive
// reopening and reach Alice's tablet when its connection returns.
module pack_authoring {
  type Draft = { exists: bool, contents: List[int] }
  pure val _EMPTY = { exists: false, contents: List() }
  // River, Valley and Harbor are published puzzles of this game; another
  // game's puzzle is 4. The new private puzzle created from this pack is 3.
  pure val _SAME_GAME = Set(0, 1, 2, 3)

  pure def _has(order: List[int], puzzle: int): bool =
    order.indices().exists(i => order.nth(i) == puzzle)

  var draft: Draft
  var otherDraft: Draft
  var createdPuzzle: bool
  var discoverable: bool
  var title: str
  var description: str
  var _online: bool
  var _created: bool

  action _keep(saved: Draft, puzzle: bool, online: bool): bool = all {
    draft' = saved, otherDraft' = (if (online) saved else otherDraft),
    createdPuzzle' = puzzle, discoverable' = false,
    title' = (if (saved.exists) "Rivers" else ""),
    description' = (if (saved.exists) "A gentle beginning" else ""),
    _online' = online, _created' = (_created or saved.exists),
  }

  action init = all {
    draft' = _EMPTY, otherDraft' = _EMPTY, createdPuzzle' = false,
    discoverable' = false, title' = "", description' = "",
    _online' = true, _created' = false,
  }

  /// One chosen pack and one new puzzle bound exploration, not the product.
  action createPackDraft: bool = all {
    not(draft.exists), _keep({ exists: true, contents: List() }, createdPuzzle, _online),
  }

  /// Duplicate puzzles and another game's puzzle leave the pack unchanged.
  action addPackPuzzle(puzzle: int): bool = all {
    draft.exists, Set(0, 1, 2, 4).contains(puzzle),
    _keep({ ...draft, contents: (if (_SAME_GAME.contains(puzzle) and
      not(_has(draft.contents, puzzle))) draft.contents.append(puzzle) else draft.contents) },
      createdPuzzle, _online),
  }

  /// Removing an included puzzle retains the relative order of all others.
  action removePackPuzzle(puzzle: int): bool = all {
    draft.exists, _has(draft.contents, puzzle),
    _keep({ ...draft, contents: draft.contents.select(p => p != puzzle) }, createdPuzzle, _online),
  }

  /// A person chooses two distinct included puzzles to change their order.
  action reorderPackPuzzle(puzzle: int, before: int): bool = all {
    draft.exists, _has(draft.contents, puzzle), _has(draft.contents, before), puzzle != before,
    val remaining = draft.contents.select(p => p != puzzle)
    val ordered = remaining.foldl(List(), (order, p) =>
      if (p == before) order.append(puzzle).append(p) else order.append(p))
    _keep({ ...draft, contents: ordered }, createdPuzzle, _online),
  }

  action createPackPuzzle: bool = all {
    draft.exists, not(createdPuzzle),
    _keep({ ...draft, contents: draft.contents.append(3) }, true, _online),
  }

  action reopenApp: bool = _keep(draft, createdPuzzle, _online)
  /// Model-only: the phone loses its connection and retains accepted work.
  action _loseConnection: bool = all { _online, _keep(draft, createdPuzzle, false) }
  action connectionReturns: bool = all { not(_online), _keep(draft, createdPuzzle, true) }

  action step = {
    nondet puzzle = Set(0, 1, 2, 3, 4).oneOf()
    nondet before = Set(0, 1, 2, 3).oneOf()
    any { createPackDraft, addPackPuzzle(puzzle), removePackPuzzle(puzzle),
      reorderPackPuzzle(puzzle, before), createPackPuzzle, reopenApp,
      _loseConnection, connectionReturns }
  }

  val invPackContentsAreDistinct = draft.contents.indices().forall(i =>
    draft.contents.indices().forall(j => i == j or draft.contents.nth(i) != draft.contents.nth(j)))
  val invPackContentsBelongToItsGame = draft.contents.indices().forall(i =>
    _SAME_GAME.contains(draft.contents.nth(i)))
  val invNewPuzzleBelongsToItsAuthor = _has(draft.contents, 3) implies createdPuzzle
  val invPackRemainsPrivate = not(discoverable)
  val invCreatedPackKeepsItsMetadata = _created implies
    (draft.exists and title == "Rivers" and description == "A gentle beginning")
  val invConnectedDraftsAgree = _online implies otherDraft == draft
  val invOfflinePackIsKept = not(_online) implies (_created implies draft.exists)
}
