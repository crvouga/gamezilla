// Naming a space.
//
// Alice hosts a space Bob is in. Alice can rename the space: a name that is
// allowed is saved and everyone in the space sees it; a name that is not
// allowed is refused and the space keeps the name it had. A space with no
// name of its own is named after its host. The team can stop allowing a
// name, and start allowing it again. A space whose name is no longer allowed is shown
// named after its host, while Alice keeps the name she gave it, so once it is
// allowed again everyone sees it again; renaming the space to it is refused
// while it is not allowed.
//
// Either of them can lose the connection and get it back. Offline, Alice's
// rename shows on her own device at once and reaches Bob once both are
// connected; a name that is not allowed is refused offline too, and Bob keeps
// the last name he saw until he is back. Each offline device applies the
// rules it already knows and learns changed rules when its connection returns.
//
// What a person can observe: what each of them sees the space called, and
// what Alice's last rename showed her.
module space_names {
  type Person = str

  /// Alice hosts; Bob is in her space.
  pure val PEOPLE: Set[Person] = Set("alice", "bob")

  /// What Alice types: no name, two ordinary names, and one the rules always
  /// refuse.
  pure val NAMES: Set[str] =
    Set("", "Friday puzzles", "Cheater corner", "free coins at spam.gg")

  /// Space names the rules always refuse.
  pure val ALWAYS_REFUSED: Set[str] = Set("free coins at spam.gg")

  /// Space names the team may stop allowing, and start allowing again.
  pure val CHANGEABLE: Set[str] = Set("Friday puzzles", "Cheater corner")

  /// What a space with no allowed name of its own is called.
  pure val NAMED_AFTER_HOST = "named after Alice"

  /// What Alice's last rename showed her.
  type RenameResult =
    | NoRename
    | NameSaved
    | NameNotAllowed

  /// The name Alice gave the space, as her device has it; kept even when it
  /// is no longer allowed.
  var givenName: str
  /// What each person sees the space called.
  var spaceName: Person -> str
  /// Space names the rules refuse right now.
  var _notAllowed: Set[str]
  /// What Alice's last rename showed her.
  var lastRename: RenameResult
  /// The name Alice gave the space, as everyone else has it.
  var _sharedName: str
  /// The name Alice gave the space, as each device last heard it.
  var _known: Person -> str
  /// Naming rules each device already knows.
  var _knownNotAllowed: Person -> Set[str]
  /// People whose device has lost the connection.
  var _offline: Set[Person]
  /// The name Alice last typed.
  var _lastTyped: str

  /// What a space given `name` is called under the rules `refused`.
  pure def _called(name: str, refused: Set[str]): str =
    if (name == "" or refused.contains(name)) NAMED_AFTER_HOST else name

  /// What each device has heard the space was given.
  pure def _heard(given: str, shared: str, known: Person -> str, offline: Set[Person]): Person -> str =
    PEOPLE.mapBy(p =>
      if (p == "alice") given else if (offline.contains(p)) known.get(p) else shared
    )

  /// Moves to the next state; everything a person sees follows from it.
  action _update(
    given: str,
    shared: str,
    refused: Set[str],
    result: RenameResult,
    offline: Set[Person],
    typed: str,
  ): bool = {
    val known = _heard(given, shared, _known, offline)
    val rules = PEOPLE.mapBy(p => if (offline.contains(p)) _knownNotAllowed.get(p) else refused)
    all {
      givenName' = given,
      spaceName' = PEOPLE.mapBy(p => _called(known.get(p), rules.get(p))),
      _notAllowed' = refused,
      lastRename' = result,
      _sharedName' = shared,
      _known' = known,
      _knownNotAllowed' = rules,
      _offline' = offline,
      _lastTyped' = typed,
    }
  }

  action init = all {
    givenName' = "",
    spaceName' = PEOPLE.mapBy(_ => NAMED_AFTER_HOST),
    _notAllowed' = ALWAYS_REFUSED,
    lastRename' = NoRename,
    _sharedName' = "",
    _known' = PEOPLE.mapBy(_ => ""),
    _knownNotAllowed' = PEOPLE.mapBy(_ => ALWAYS_REFUSED),
    _offline' = Set(),
    _lastTyped' = "",
  }

  /// Alice renames the space to `typed`.
  action rename(typed: str): bool =
    if (_knownNotAllowed.get("alice").contains(typed))
      _update(givenName, _sharedName, _notAllowed, NameNotAllowed, _offline, typed)
    else
      _update(
        typed,
        if (_offline.contains("alice")) _sharedName else typed,
        _notAllowed, NameSaved, _offline, typed,
      )

  /// The team stops allowing `name` as a space name.
  action stopAllowing(name: str): bool = all {
    CHANGEABLE.contains(name),
    not(_notAllowed.contains(name)),
    _update(givenName, _sharedName, _notAllowed.union(Set(name)), lastRename, _offline, _lastTyped),
  }

  /// The team starts allowing `name` as a space name again.
  action startAllowing(name: str): bool = all {
    CHANGEABLE.contains(name),
    _notAllowed.contains(name),
    _update(givenName, _sharedName, _notAllowed.exclude(Set(name)), lastRename, _offline, _lastTyped),
  }

  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _update(givenName, _sharedName, _notAllowed, lastRename, _offline.union(Set(person)), _lastTyped),
  }

  /// A person's connection comes back; once Alice is back, her name is
  /// everyone's.
  action _connectionReturns(person: Person): bool = all {
    _offline.contains(person),
    _update(
      givenName,
      if (person == "alice") givenName else _sharedName,
      _notAllowed, lastRename, _offline.exclude(Set(person)), _lastTyped,
    ),
  }

  action step = {
    nondet typed = NAMES.oneOf()
    nondet name = CHANGEABLE.oneOf()
    nondet person = PEOPLE.oneOf()
    any {
      rename(typed),
      stopAllowing(name),
      startAllowing(name),
      _loseConnection(person),
      _connectionReturns(person),
    }
  }

  /// Nobody sees a space name their device knows is not allowed.
  val invNotAllowedNeverShown = PEOPLE.forall(p =>
    not(_knownNotAllowed.get(p).contains(spaceName.get(p)))
  )

  /// Alice sees the name she gave the space unless it is no longer allowed,
  /// and then the space named after her: the name itself is kept.
  val invHostSeesGivenName = spaceName.get("alice") == _called(givenName, _knownNotAllowed.get("alice"))

  /// A name the rules always refuse is never given to the space.
  val invAlwaysRefusedNeverGiven = not(ALWAYS_REFUSED.contains(givenName))

  /// A rename that showed as saved gave the space the name typed.
  val invSavedRenameGivesTypedName =
    lastRename == NameSaved implies givenName == _lastTyped

  /// A connected device knows the current naming rules.
  val invConnectedKnowsRules = PEOPLE.forall(p => not(_offline.contains(p)) implies _knownNotAllowed.get(p) == _notAllowed)

  /// Rules that always refuse a name are known on every device.
  val invStandingRulesKnown = PEOPLE.forall(p => ALWAYS_REFUSED.subseteq(_knownNotAllowed.get(p)))

  /// While both are connected, they see the space called the same.
  val invConnectedAgree =
    _offline == Set() implies spaceName.get("bob") == spaceName.get("alice")
}
