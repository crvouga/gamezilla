// Alice edits a private puzzle or pack, and can undo and redo her choices.
// Undo keeps draft copies; a different edit replaces only the redo choice.
// Reopening keeps the draft and begins fresh undo and redo choices.
// The phone starts connected. Offline edits reach the tablet on return.
// The names and two pack orders are examples, not limits on authoring.
module draft_editing {
  type EditingDraft = { kind: str, title: str, valid: bool, contents: List[str] }
  pure val TITLES = Set("River", "Valley", "Harbor")
  pure val ORDERS = Set(List("River", "Valley"), List("Valley", "River"))

  var draft: EditingDraft
  var otherDraft: EditingDraft
  var keptCopies: Set[EditingDraft]
  var undoOffered: bool
  var redoOffered: bool
  var _earlier: List[EditingDraft]
  var _undone: List[EditingDraft]
  var _online: bool

  action _keep(saved: EditingDraft, earlier: List[EditingDraft], undone: List[EditingDraft], online: bool): bool = all {
    draft' = saved, otherDraft' = (if (online) saved else otherDraft),
    keptCopies' = keptCopies.union(Set(saved)),
    undoOffered' = earlier.length() > 0, redoOffered' = undone.length() > 0,
    _earlier' = earlier, _undone' = undone, _online' = online,
  }

  action init = {
    nondet kind = Set("puzzle", "pack").oneOf()
    val first = { kind: kind, title: "River", valid: kind == "pack",
      contents: (if (kind == "pack") List("River", "Valley") else List()) }
    all {
      draft' = first, otherDraft' = first, keptCopies' = Set(first),
      undoOffered' = false, redoOffered' = false,
      _earlier' = List(), _undone' = List(), _online' = true,
    }
  }

  /// Each save changes one title, puzzle detail or pack order; unchanged work adds no edit.
  action saveAuthoringDraft(saved: EditingDraft): bool =
    _keep(saved,
      if (saved == draft) _earlier else _earlier.append(draft),
      if (saved == draft) _undone else List(), _online)

  /// Undo is offered only with an earlier edit, and keeps the current copy available.
  action undoDraftEdit: bool = all {
    _earlier.length() > 0,
    _keep(_earlier.nth(_earlier.length() - 1),
      _earlier.slice(0, _earlier.length() - 1), _undone.append(draft), _online),
  }

  /// Redo is offered only while a different edit has not replaced the undone choice.
  action redoDraftEdit: bool = all {
    _undone.length() > 0,
    _keep(_undone.nth(_undone.length() - 1), _earlier.append(draft),
      _undone.slice(0, _undone.length() - 1), _online),
  }

  action reopenApp: bool = _keep(draft, List(), List(), _online)
  /// Model-only: the phone loses its connection and keeps its editing choices.
  action _loseConnection: bool = all { _online, _keep(draft, _earlier, _undone, false) }
  action connectionReturns: bool = all { not(_online), _keep(draft, _earlier, _undone, true) }

  action step = {
    val titles = TITLES.map(title => { ...draft, title: title })
    val details = if (draft.kind == "puzzle") Set({ ...draft, valid: not(draft.valid) })
      else ORDERS.map(contents => { ...draft, contents: contents })
    nondet saved = titles.union(details).oneOf()
    any { saveAuthoringDraft(saved), undoDraftEdit, redoDraftEdit,
      reopenApp, _loseConnection, connectionReturns }
  }

  /// The current draft remains available as a kept copy, including after undo.
  val invCurrentDraftHasKeptCopy = keptCopies.contains(draft)
  /// Undo is offered exactly when this editing has an earlier choice.
  val invUndoHasEarlierEdit = undoOffered == (_earlier.length() > 0)
  /// Redo is offered exactly when an undone choice has not been replaced.
  val invRedoHasUndoneEdit = redoOffered == (_undone.length() > 0)
  /// Connected devices keep the same chosen draft after an edit or undo.
  val invConnectedDraftsAgree = _online implies otherDraft == draft
}
