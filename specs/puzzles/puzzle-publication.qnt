// Alice keeps private puzzle drafts, chooses a kept copy, publishes valid
// editions and withdraws discovery. Bob can discover published content but
// cannot change Alice's work. Saving incomplete work is allowed. Publishing
// the same saved draft again never replaces a later publication or withdrawal.
// Alice's phone starts connected. Offline, her saved work remains available
// after reopening; her tablet and Bob see changes when the connection returns.
module puzzle_publication {
  type Draft = { title: str, valid: bool }
  type Edition = { title: str, valid: bool, author: str }
  pure val PEOPLE = Set("Alice", "Bob")
  pure val TITLES = Set("River", "Valley", "Harbor", "")

  var drafts: List[Draft]
  var workingDraft: int
  var otherDraft: int
  var editions: int -> Edition
  var currentEdition: int
  var discoveredEdition: int
  var _online: bool
  var _previousEditions: int -> Edition
  var _previousDrafts: List[Draft]

  action _keep(copies: List[Draft], chosen: int, published: int -> Edition,
    current: int, online: bool): bool = all {
    drafts' = copies, workingDraft' = chosen,
    otherDraft' = (if (not(online)) otherDraft else chosen),
    editions' = published, currentEdition' = current,
    discoveredEdition' = (if (not(online)) discoveredEdition else current),
    _online' = online, _previousEditions' = editions, _previousDrafts' = drafts,
  }

  action init = all {
    drafts' = List({ title: "River", valid: true }), workingDraft' = 0,
    otherDraft' = 0, editions' = Map(), currentEdition' = -1,
    discoveredEdition' = -1, _online' = true, _previousEditions' = Map(),
    _previousDrafts' = List(),
  }

  /// Alice saves another draft; Bob's attempt leaves her work unchanged.
  /// Four copies bound exploration, rather than imposing a product limit.
  action savePuzzleDraft(person: str, title: str, valid: bool): bool = all {
    drafts.length() < 4, PEOPLE.contains(person), TITLES.contains(title),
    if (person == "Alice")
      _keep(drafts.append({ title: title, valid: valid }), drafts.length(),
        editions, currentEdition, _online)
    else _keep(drafts, workingDraft, editions, currentEdition, _online),
  }

  /// The connected tablet saves a different edit based on the earlier draft.
  /// Both complete copies remain choices; this does not replace the phone's choice.
  action saveEarlierPuzzleDraft(title: str, valid: bool): bool = all {
    _online, drafts.length() > 1, drafts.length() < 4, TITLES.contains(title),
    { title: title, valid: valid } != drafts.nth(workingDraft),
    { title: title, valid: valid } != drafts.nth(0),
    _keep(drafts.append({ title: title, valid: valid }), workingDraft,
      editions, currentEdition, _online),
  }

  /// Choosing a kept copy keeps every earlier copy available.
  action choosePuzzleDraft(person: str, draft: int): bool = all {
    drafts.indices().contains(draft), drafts.length() < 4, PEOPLE.contains(person),
    if (person == "Alice")
      _keep(drafts.append(drafts.nth(draft)), drafts.length(),
        editions, currentEdition, _online)
    else _keep(drafts, workingDraft, editions, currentEdition, _online),
  }

  /// Only Alice publishes her chosen working draft. Another kept copy must
  /// first be chosen. An already published draft may be repeated without
  /// replacing a later publication or withdrawal.
  action publishPuzzle(person: str, draft: int): bool = all {
    PEOPLE.contains(person), drafts.indices().contains(draft),
    draft == workingDraft or editions.keys().contains(draft),
    if (person == "Alice" and drafts.nth(draft).valid and
      drafts.nth(draft).title != "" and not(editions.keys().contains(draft)))
      _keep(drafts, workingDraft, editions.put(draft,
        { title: drafts.nth(draft).title, valid: true, author: person }), draft, _online)
    else _keep(drafts, workingDraft, editions, currentEdition, _online),
  }

  /// Withdrawing hides discovery and retains every edition and private draft.
  action withdrawPuzzle(person: str): bool = all {
    PEOPLE.contains(person),
    _keep(drafts, workingDraft, editions,
      if (person == "Alice") -1 else currentEdition, _online),
  }

  /// Reopening retains the chosen draft and publication, also offline.
  action reopenApp: bool = _keep(drafts, workingDraft, editions, currentEdition, _online)

  /// Model-only: the phone loses its connection; accepted work stays on it.
  action _loseConnection: bool = all {
    _online, _keep(drafts, workingDraft, editions, currentEdition, false),
  }

  /// The tablet receives the author's kept draft when the phone returns online.
  action connectionReturns: bool = all {
    not(_online), _keep(drafts, workingDraft, editions, currentEdition, true),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet title = TITLES.oneOf()
    nondet valid = Set(true, false).oneOf()
    nondet draft = drafts.indices().oneOf()
    any { savePuzzleDraft(person, title, valid), saveEarlierPuzzleDraft(title, valid),
      choosePuzzleDraft(person, draft),
      publishPuzzle(person, draft), withdrawPuzzle(person), reopenApp,
      _loseConnection, connectionReturns }
  }

  /// Every edition is valid, named and published by its author.
  val invPublishedContentIsValid = editions.keys().forall(e =>
    editions.get(e).valid and editions.get(e).title != "" and editions.get(e).author == "Alice")
  /// No later edit, publication or withdrawal changes an earlier edition.
  val invEditionsNeverChange = _previousEditions.keys().forall(e =>
    editions.keys().contains(e) and editions.get(e) == _previousEditions.get(e))
  /// Saving from an earlier draft cannot overwrite either complete saved copy.
  val invDraftCopiesNeverChange = _previousDrafts.indices().forall(d =>
    drafts.indices().contains(d) and drafts.nth(d) == _previousDrafts.nth(d))
  val invDiscoveryChoosesAnEdition = Set(currentEdition, discoveredEdition).forall(e =>
    e == -1 or editions.keys().contains(e))
  /// Connected devices agree; private drafts do not become public by saving.
  val invConnectedDevicesAgree = _online implies
    (workingDraft == otherDraft and currentEdition == discoveredEdition)
  /// Offline work and every kept copy remain available after reopening.
  val invOfflineWorkIsKept = not(_online) implies
    (drafts.indices().contains(workingDraft) and drafts.indices().contains(otherDraft))
}
