// One account's saved puzzle feed choices on two devices.
// Editing previews a choice; only saving replaces the saved choice.
// Closing an edit discards its preview. A saved choice survives reopening.
// Offline saving changes that device at once. The other device sees the
// previously saved choice until the connection returns, then both agree.
// These choices represent each supported kind of setting; their numeric
// boundaries and combinations are checked with the feed's examples.
module puzzle_feed {
  type Device = str
  pure val SOLVER = "alice"
  pure val SECOND_DEVICE = "charlie"
  pure val DEVICES = Set(SOLVER, SECOND_DEVICE)
  pure val CHOICES = Set("own rating", "harder", "chosen rating", "any history",
    "played", "failed", "mate in two", "after one second", "immediately")

  /// The saved feed choice each device shows.
  var feedChoice: Device -> str
  /// Whether the solver is previewing changes to the feed settings.
  var editing: bool
  var _draft: str
  var _saved: str
  var _pending: bool
  var _offline: Set[Device]

  action init = all {
    feedChoice' = DEVICES.mapBy(_ => "own rating"), editing' = false,
    _draft' = "own rating", _saved' = "own rating", _pending' = false,
    _offline' = Set(),
  }

  /// A connected saving device sends its choice; connected devices receive it.
  action _refresh(choice: str, draft: str, edit: bool, pending: bool,
    offline: Set[Device]): bool = {
    val sent = pending and not(offline.contains(SOLVER))
    val saved = if (sent) choice else _saved
    all {
      feedChoice' = Map(SOLVER -> choice,
        SECOND_DEVICE -> (if (offline.contains(SECOND_DEVICE)) feedChoice.get(SECOND_DEVICE) else saved)),
      editing' = edit, _draft' = draft, _saved' = saved,
      _pending' = (pending and not(sent)), _offline' = offline,
    }
  }

  action startEditingFeed: bool = all {
    not(editing),
    _refresh(feedChoice.get(SOLVER), feedChoice.get(SOLVER), true, _pending, _offline),
  }

  action previewFeedChoice(choice: str): bool = all {
    editing, CHOICES.contains(choice),
    _refresh(feedChoice.get(SOLVER), choice, true, _pending, _offline),
  }

  action saveFeedChoices: bool = all {
    editing,
    _refresh(_draft, _draft, false, true, _offline),
  }

  action discardFeedChoices: bool = all {
    editing,
    _refresh(feedChoice.get(SOLVER), feedChoice.get(SOLVER), false, _pending, _offline),
  }

  /// Reopening retains saved choices and discards an unfinished edit.
  action reopenApp: bool =
    _refresh(feedChoice.get(SOLVER), feedChoice.get(SOLVER), false, _pending, _offline)

  action _loseConnection(device: Device): bool = all {
    not(_offline.contains(device)),
    _refresh(feedChoice.get(SOLVER), _draft, editing, _pending, _offline.union(Set(device))),
  }

  action connectionReturns(device: Device): bool = all {
    _offline.contains(device),
    _refresh(feedChoice.get(SOLVER), _draft, editing, _pending, _offline.exclude(Set(device))),
  }

  action _wait: bool =
    _refresh(feedChoice.get(SOLVER), _draft, editing, _pending, _offline)

  action step = {
    nondet choice = CHOICES.oneOf()
    nondet device = DEVICES.oneOf()
    any { startEditingFeed, previewFeedChoice(choice), saveFeedChoices,
      discardFeedChoices, reopenApp, _loseConnection(device),
      connectionReturns(device), _wait }
  }

  val invSavedChoicesAreRecognized = DEVICES.forall(d => CHOICES.contains(feedChoice.get(d)))
  val invPreviewIsRecognized = editing implies CHOICES.contains(_draft)
  val invConnectedDevicesAgree = (_offline == Set() and not(_pending)) implies
    feedChoice.get(SOLVER) == feedChoice.get(SECOND_DEVICE)
  val invUnsentChoicesStayOnTheirDevice =
    (_offline.contains(SOLVER) and _pending and not(_offline.contains(SECOND_DEVICE))) implies
      feedChoice.get(SECOND_DEVICE) == _saved

  val _state = (feedChoice, editing, _draft, _saved, _pending, _offline)
  temporal _bothReturn = eventually(always(_offline == Set()))
  /// Once both devices can keep connecting, their saved choices agree.
  temporal liveSavedChoicesFollowAccount = _bothReturn.implies(eventually(always(
    feedChoice.get(SOLVER) == feedChoice.get(SECOND_DEVICE))))
}
