// People choose a username under the rules their device knows. A valid
// offline choice appears for them at once and survives reopening the app;
// other people keep the last shared username until the connection returns.
// Sharing refuses a name another person has claimed, or one no longer
// allowed, with the reason shown and the last shared username restored.
// Names accepted for sharing are unique and lowercase. Refused choices do
// not count as a change. The team can stop allowing and start allowing a
// name; an offline device applies its known rules until it returns.
module username_changes {
  type Person = str
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")
  pure val NAMES = Set("ann", "Ann", "bea", "alice", "official_support")
  pure val ALWAYS_REFUSED = Set("official_support")
  pure val CHANGEABLE = Set("ann", "bea", "alice")
  pure val STAND_INS = Map("alice" -> "Brave Tiger 1", "bob" -> "Calm Otter 2", "carol" -> "Swift Heron 3")
  pure val GENERATED = "generated"
  type UsernameChangeResult = NoUsernameChange | UsernameSaved | UsernameTaken | NotAllowed | ChangedRecently

  /// Each person's accepted choice on their own device.
  var username: Person -> str
  /// Each person's own profile, under the username rules their device knows.
  var usernameOnDevice: Person -> str
  var lastUsernameChange: Person -> UsernameChangeResult
  var offline: Set[Person]
  var _sharedUsernames: Person -> str
  var _shownName: Person -> str
  var _notAllowed: Set[str]
  var _knownNotAllowed: Person -> Set[str]
  var _knownNames: Person -> (Person -> str)
  var _waitingNames: Person -> List[str]
  var _sharedAtCutOff: Person -> str

  pure def _lowercase(name: str): str = if (name == "Ann") "ann" else name
  pure def _shown(names: Person -> str, refused: Set[str]): Person -> str =
    PEOPLE.mapBy(p => if (refused.contains(names.get(p))) STAND_INS.get(p) else names.get(p))
  pure def _ownShown(names: Person -> str, rules: Person -> Set[str]): Person -> str =
    PEOPLE.mapBy(p => if (rules.get(p).contains(names.get(p))) STAND_INS.get(p) else names.get(p))
  pure def _takenBy(names: Person -> str, person: Person, name: str): bool =
    PEOPLE.exists(other => other != person and names.get(other) == name)
  pure def _resultOf(names: Person -> str, refused: Set[str], person: Person, typed: str, cooling: bool): UsernameChangeResult =
    if (refused.contains(_lowercase(typed))) NotAllowed
    else if (_lowercase(typed) == names.get(person)) UsernameSaved
    else if (cooling) ChangedRecently
    else if (_takenBy(names, person, _lowercase(typed))) UsernameTaken
    else UsernameSaved

  action _keep(local: Person -> str, shared: Person -> str, refused: Set[str], results: Person -> UsernameChangeResult,
    away: Set[Person], waiting: Person -> List[str], cutOff: Person -> str): bool = {
    val rules = PEOPLE.mapBy(p => if (away.contains(p)) _knownNotAllowed.get(p) else refused)
    all {
      username' = local,
      usernameOnDevice' = _ownShown(local, rules),
      lastUsernameChange' = results, offline' = away,
      _sharedUsernames' = shared, _shownName' = _shown(shared, refused),
      _notAllowed' = refused, _knownNotAllowed' = rules,
      _knownNames' = PEOPLE.mapBy(p => if (away.contains(p)) _knownNames.get(p) else shared),
      _waitingNames' = waiting, _sharedAtCutOff' = cutOff,
    }
  }

  /// bookkeeping: apply a choice to the person's own known names and rules.
  def _choice(person: Person, typed: str, cooling: bool, local: Person -> str, shared: Person -> str,
    waiting: Person -> List[str]): { local: Person -> str, shared: Person -> str, waiting: Person -> List[str], result: UsernameChangeResult } = {
    val names = (if (offline.contains(person)) _knownNames.get(person) else shared).set(person, local.get(person))
    val result = _resultOf(names, _knownNotAllowed.get(person), person, typed, cooling)
    val accepted = result == UsernameSaved
    val after = if (accepted) local.set(person, _lowercase(typed)) else local
    { local: after, result: result,
      shared: if (accepted and not(offline.contains(person))) shared.set(person, _lowercase(typed)) else shared,
      waiting: if (accepted and offline.contains(person)) waiting.set(person, waiting.get(person).append(_lowercase(typed))) else waiting }
  }

  action init = {
    val names = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED)
    all {
      username' = names, usernameOnDevice' = names,
      lastUsernameChange' = PEOPLE.mapBy(_ => NoUsernameChange), offline' = Set(),
      _sharedUsernames' = names, _shownName' = names, _notAllowed' = ALWAYS_REFUSED,
      _knownNotAllowed' = PEOPLE.mapBy(_ => ALWAYS_REFUSED),
      _knownNames' = PEOPLE.mapBy(_ => names), _waitingNames' = PEOPLE.mapBy(_ => List()),
      _sharedAtCutOff' = names,
    }
  }

  /// A person saves a choice, a while after their previous change.
  action rename(person: Person, typed: str): bool = {
    val after = _choice(person, typed, false, username, _sharedUsernames, _waitingNames)
    _keep(after.local, after.shared, _notAllowed, lastUsernameChange.set(person, after.result), offline, after.waiting, _sharedAtCutOff)
  }

  /// A person saves a choice and immediately tries another one.
  action renameTwice(person: Person, typed: str, retyped: str): bool = {
    val between = _choice(person, typed, false, username, _sharedUsernames, _waitingNames)
    val after = _choice(person, retyped, between.local.get(person) != username.get(person), between.local, between.shared, between.waiting)
    _keep(after.local, after.shared, _notAllowed, lastUsernameChange.set(person, after.result), offline, after.waiting, _sharedAtCutOff)
  }

  action stopAllowing(name: str): bool = all {
    CHANGEABLE.contains(name), not(_notAllowed.contains(name)),
    _keep(username, _sharedUsernames, _notAllowed.union(Set(name)), lastUsernameChange, offline, _waitingNames, _sharedAtCutOff),
  }
  action startAllowing(name: str): bool = all {
    CHANGEABLE.contains(name), _notAllowed.contains(name),
    _keep(username, _sharedUsernames, _notAllowed.exclude(Set(name)), lastUsernameChange, offline, _waitingNames, _sharedAtCutOff),
  }
  action loseConnection(person: Person): bool = all {
    not(offline.contains(person)),
    _keep(username, _sharedUsernames, _notAllowed, lastUsernameChange, offline.union(Set(person)), _waitingNames,
      _sharedAtCutOff.set(person, _sharedUsernames.get(person))),
  }

  /// This person returns and shares their offline choices in the order made.
  action connectionReturns(person: Person): bool = {
    val settled = _waitingNames.get(person).foldl({ names: _sharedUsernames, result: NoUsernameChange }, (before, name) => {
      val result = _resultOf(before.names, _notAllowed, person, name, false)
      { names: if (result == UsernameSaved) before.names.set(person, name) else before.names, result: result }
    })
    val refused = Set(UsernameTaken, NotAllowed).contains(settled.result)
    all {
      offline.contains(person),
      _keep(username.set(person, settled.names.get(person)), settled.names, _notAllowed,
        if (refused) lastUsernameChange.set(person, settled.result) else lastUsernameChange,
        offline.exclude(Set(person)), _waitingNames.set(person, List()), _sharedAtCutOff),
    }
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet typed = NAMES.oneOf()
    nondet retyped = NAMES.oneOf()
    nondet name = CHANGEABLE.oneOf()
    any { rename(person, typed), renameTwice(person, typed, retyped), stopAllowing(name), startAllowing(name),
      loseConnection(person), connectionReturns(person) }
  }

  /// Shared usernames are unique; offline choices remain private until accepted.
  val invNamesAreUnique = PEOPLE.forall(p => PEOPLE.forall(q => p == q or _sharedUsernames.get(p) != _sharedUsernames.get(q)))
  /// Connected people show the shared username or its stand-in name.
  val invDeviceShowsUsername = PEOPLE.forall(p => not(offline.contains(p)) implies usernameOnDevice.get(p) == _shownName.get(p))
  val invShownNameIsUsernameOrStandIn = _shownName == _shown(_sharedUsernames, _notAllowed)
  val invNotAllowedNeverShown = PEOPLE.forall(p => not(_notAllowed.contains(_shownName.get(p))))
  val invOwnDeviceUsesKnownRules = usernameOnDevice == _ownShown(username, _knownNotAllowed)
  val invConnectedKnowsRules = PEOPLE.forall(p => not(offline.contains(p)) implies _knownNotAllowed.get(p) == _notAllowed)
  val invAlwaysRefusedNeverSaved = PEOPLE.forall(p => not(ALWAYS_REFUSED.contains(username.get(p))))
  val invStoredLowercase = PEOPLE.forall(p => username.get(p) != "Ann")
  /// An accepted choice does not take a name the device knows belongs to someone else.
  val invSavedChoiceUsesKnownNames = PEOPLE.forall(p => lastUsernameChange.get(p) == UsernameSaved implies
    not(_takenBy(_knownNames.get(p), p, username.get(p))))
  /// An offline choice cannot change the name other people already know.
  val invOfflineKeepsSharedUsername = PEOPLE.forall(p => offline.contains(p) implies _sharedUsernames.get(p) == _sharedAtCutOff.get(p))
  /// An offline choice is shared automatically once the person's connection returns.
  val invConnectedChoiceIsShared = PEOPLE.forall(p => not(offline.contains(p)) implies
    username.get(p) == _sharedUsernames.get(p) and _waitingNames.get(p) == List())
}
