// Alice creates and saves private puzzle drafts, including incomplete work.
// She can inspect, validate and playtest her work; Bob cannot read it.
// A playtest keeps the draft it began with and never counts as ordinary play.
// The phone starts connected. Offline creation, editing and playtesting remain
// available after reopening; saved drafts reach Alice's tablet on reconnection.
module puzzle_authoring {
  type Draft = { exists: bool, title: str, valid: bool, described: bool }
  type Playtest = { exists: bool, title: str, valid: bool, completed: bool }
  pure val PEOPLE = Set("Alice", "Bob")
  pure val TITLES = Set("River", "Valley")
  pure val _EMPTY = { exists: false, title: "", valid: false, described: false }
  pure val _NO_PLAYTEST = { exists: false, title: "", valid: false, completed: false }

  var draft: Draft
  var otherDraft: Draft
  var playtest: Playtest
  var otherCanRead: bool
  var discoverable: bool
  var ordinaryAttempts: int
  var ordinaryCompletions: int
  var _online: bool
  var _created: bool

  action _keep(saved: Draft, practice: Playtest, online: bool): bool = all {
    draft' = saved, otherDraft' = (if (online) saved else otherDraft),
    playtest' = practice, otherCanRead' = false, discoverable' = false,
    ordinaryAttempts' = 0, ordinaryCompletions' = 0,
    _online' = online, _created' = (_created or saved.exists),
  }

  action init = all {
    draft' = _EMPTY, otherDraft' = _EMPTY, playtest' = _NO_PLAYTEST,
    otherCanRead' = false, discoverable' = false,
    ordinaryAttempts' = 0, ordinaryCompletions' = 0,
    _online' = true, _created' = false,
  }

  /// One draft represents this aggregate, rather than limiting creation.
  action createPuzzleDraft: bool = all {
    not(draft.exists),
    _keep({ exists: true, title: "River", valid: false, described: false }, playtest, _online),
  }

  /// Saving incomplete work, a title, description or difficulty keeps the draft.
  /// Described means the example's description and difficulty are both present.
  action saveAuthoringDraft(person: str, title: str, valid: bool, described: bool): bool = all {
    draft.exists, PEOPLE.contains(person), TITLES.contains(title),
    _keep(if (person == "Alice")
      { exists: true, title: title, valid: valid, described: described } else draft,
      playtest, _online),
  }

  /// Reading and checking never publish, change or discard the saved draft.
  action inspectPuzzleDraft(person: str): bool = all {
    draft.exists, PEOPLE.contains(person), _keep(draft, playtest, _online),
  }
  action validateDraft: bool = all {
    draft.exists, _keep(draft, playtest, _online),
  }

  /// Only the author starts private practice of a valid draft.
  action beginPlaytest(person: str): bool = all {
    draft.exists, draft.valid, PEOPLE.contains(person),
    _keep(draft, if (person == "Alice")
      { exists: true, title: draft.title, valid: true, completed: false } else playtest, _online),
  }

  /// Completing practice does not create ordinary attempts or completion.
  action completePlaytest: bool = all {
    playtest.exists, _keep(draft, { ...playtest, completed: true }, _online),
  }

  action reopenApp: bool = _keep(draft, playtest, _online)
  /// Model-only: the phone loses its connection and retains accepted work.
  action _loseConnection: bool = all { _online, _keep(draft, playtest, false) }
  action connectionReturns: bool = all { not(_online), _keep(draft, playtest, true) }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet title = TITLES.oneOf()
    nondet valid = Set(true, false).oneOf()
    nondet described = Set(true, false).oneOf()
    any { createPuzzleDraft, saveAuthoringDraft(person, title, valid, described),
      inspectPuzzleDraft(person), validateDraft, beginPlaytest(person), completePlaytest,
      reopenApp, _loseConnection, connectionReturns }
  }

  val invDraftRemainsPrivate = not(otherCanRead) and not(discoverable)
  val invCreatedDraftIsKept = _created implies draft.exists
  val invPlaytestKeepsAValidDraft = playtest.exists implies
    (playtest.valid and TITLES.contains(playtest.title))
  val invPlaytestsNeverCountAsOrdinaryPlay = ordinaryAttempts == 0 and ordinaryCompletions == 0
  val invCompletedPlaytestExists = playtest.completed implies playtest.exists
  val invConnectedDraftsAgree = _online implies otherDraft == draft
  val invOfflineDraftIsKept = not(_online) implies (_created implies draft.exists)
}
