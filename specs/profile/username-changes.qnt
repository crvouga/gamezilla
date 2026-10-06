// Changing a username.
//
// Alice and Bob are signed in; Carol is a guest with a generated username.
// Anyone can rename themselves: pick a new username and save it. The username
// change then shows one of: "Saved" (the username is theirs now), "Username
// is taken" (someone else has it, in any letter case), "That username is not
// allowed" (the rules refuse it, even when it is the username they already
// have), "Username was changed recently" (they renamed themselves moments ago
// and must wait), or "You're offline" (a username change needs a connection). Usernames are saved in
// lowercase, and saving the username a person already has is simply saved. A
// refused username change changes nothing, and does not count as a change. A
// person can save once and, on seeing the result, right away save another
// username.
//
// The team can stop allowing a username and start allowing it again. A saved username
// that is no longer allowed is kept, never changed or taken away: everyone,
// its person included, sees their stand-in name instead, until they rename
// themselves or the team starts allowing it again. A change to the rules
// shows on every device at once, even one without a connection.
//
// A person can lose their connection, and the connection can come back.
// The name everyone else sees for a person and the one on that person's own
// device always agree, and nobody ever sees a username that is not allowed.
module username_changes {
  type Person = str

  /// Alice and Bob sign in with Google; Carol stays a guest.
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// What people type: few enough that names collide, in two letter cases,
  /// and one the rules always refuse.
  pure val NAMES: Set[str] = Set("ann", "Ann", "bea", "alice", "official_support")

  /// Usernames the rules always refuse.
  pure val ALWAYS_REFUSED: Set[str] = Set("official_support")

  /// Saved usernames the team may stop allowing, and start allowing again.
  pure val CHANGEABLE: Set[str] = Set("ann", "bea", "alice")

  /// Each person's stand-in name, the same every time.
  pure val STAND_INS: Person -> str =
    Map("alice" -> "Brave Tiger 1", "bob" -> "Calm Otter 2", "carol" -> "Swift Heron 3")

  /// A guest's first username, generated for them.
  pure val GENERATED = "generated"

  /// What each person's last username change showed them.
  type UsernameChangeResult =
    | NoUsernameChange
    | UsernameSaved
    | UsernameTaken
    | NotAllowed
    | ChangedRecently
    | RefusedOffline

  /// Each person's saved username, kept even when it is no longer allowed.
  var username: Person -> str
  /// The name everyone else sees for each person: their username, or their
  /// stand-in name while it is no longer allowed.
  var shownName: Person -> str
  /// The name each person's own device shows for them.
  var usernameOnDevice: Person -> str
  /// Usernames the rules refuse right now.
  var notAllowed: Set[str]
  /// The result of each person's last username change.
  var lastUsernameChange: Person -> UsernameChangeResult
  /// People whose device has lost the connection.
  var offline: Set[Person]
  /// The username a person had when their connection went, and what their
  /// last username change showed then.
  var _nameAtCutOff: Person -> str
  var _resultAtCutOff: Person -> UsernameChangeResult

  /// How a typed username is saved.
  pure def _lowercase(name: str): str = if (name == "Ann") "ann" else name

  /// What everyone sees for each person under the rules `refused`.
  pure def _shown(names: Person -> str, refused: Set[str]): Person -> str =
    PEOPLE.mapBy(p =>
      if (refused.contains(names.get(p))) STAND_INS.get(p) else names.get(p)
    )

  pure def _takenBy(names: Person -> str, person: Person, name: str): bool =
    PEOPLE.exists(other => other != person and names.get(other) == name)

  /// What a username change shows when `person` saves `typed` while the
  /// usernames are `names`; `cooling` says they changed it moments ago.
  pure def _resultOf(
    names: Person -> str,
    refused: Set[str],
    isOffline: bool,
    person: Person,
    typed: str,
    cooling: bool,
  ): UsernameChangeResult =
    if (isOffline) RefusedOffline
    else if (refused.contains(_lowercase(typed))) NotAllowed
    else if (_lowercase(typed) == names.get(person)) UsernameSaved
    else if (cooling) ChangedRecently
    else if (_takenBy(names, person, _lowercase(typed))) UsernameTaken
    else UsernameSaved

  /// The usernames after that save.
  pure def _usernamesAfter(
    names: Person -> str,
    refused: Set[str],
    isOffline: bool,
    person: Person,
    typed: str,
    cooling: bool,
  ): Person -> str =
    if (_resultOf(names, refused, isOffline, person, typed, cooling) == UsernameSaved)
      names.set(person, _lowercase(typed))
    else names

  action init = all {
    username' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    shownName' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    usernameOnDevice' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    notAllowed' = ALWAYS_REFUSED,
    lastUsernameChange' = PEOPLE.mapBy(_ => NoUsernameChange),
    offline' = Set(),
    _nameAtCutOff' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    _resultAtCutOff' = PEOPLE.mapBy(_ => NoUsernameChange),
  }

  /// A person saves a new username, a while after anything they did before.
  action rename(person: Person, typed: str): bool = {
    val isOffline = offline.contains(person)
    val after = _usernamesAfter(username, notAllowed, isOffline, person, typed, false)
    all {
      username' = after,
      shownName' = _shown(after, notAllowed),
      usernameOnDevice' = _shown(after, notAllowed),
      notAllowed' = notAllowed,
      lastUsernameChange' = lastUsernameChange.set(person, _resultOf(username, notAllowed, isOffline, person, typed, false)),
      offline' = offline,
      _nameAtCutOff' = _nameAtCutOff,
      _resultAtCutOff' = _resultAtCutOff,
    }
  }

  /// A person saves `typed` and, on seeing the result, right away `retyped`.
  action renameTwice(person: Person, typed: str, retyped: str): bool = {
    val isOffline = offline.contains(person)
    val between = _usernamesAfter(username, notAllowed, isOffline, person, typed, false)
    val changed = between.get(person) != username.get(person)
    val after = _usernamesAfter(between, notAllowed, isOffline, person, retyped, changed)
    all {
      username' = after,
      shownName' = _shown(after, notAllowed),
      usernameOnDevice' = _shown(after, notAllowed),
      notAllowed' = notAllowed,
      lastUsernameChange' = lastUsernameChange.set(person, _resultOf(between, notAllowed, isOffline, person, retyped, changed)),
      offline' = offline,
      _nameAtCutOff' = _nameAtCutOff,
      _resultAtCutOff' = _resultAtCutOff,
    }
  }

  /// The team stops allowing `name`: whoever has it keeps it, and shows as
  /// their stand-in name on every device at once.
  action stopAllowing(name: str): bool = {
    val refused = notAllowed.union(Set(name))
    all {
      CHANGEABLE.contains(name),
      not(notAllowed.contains(name)),
      username' = username,
      shownName' = _shown(username, refused),
      usernameOnDevice' = _shown(username, refused),
      notAllowed' = refused,
      lastUsernameChange' = lastUsernameChange,
      offline' = offline,
      _nameAtCutOff' = _nameAtCutOff,
      _resultAtCutOff' = _resultAtCutOff,
    }
  }

  /// The team starts allowing `name` again: whoever kept it shows by it again.
  action startAllowing(name: str): bool = {
    val refused = notAllowed.exclude(Set(name))
    all {
      CHANGEABLE.contains(name),
      notAllowed.contains(name),
      username' = username,
      shownName' = _shown(username, refused),
      usernameOnDevice' = _shown(username, refused),
      notAllowed' = refused,
      lastUsernameChange' = lastUsernameChange,
      offline' = offline,
      _nameAtCutOff' = _nameAtCutOff,
      _resultAtCutOff' = _resultAtCutOff,
    }
  }

  action loseConnection(person: Person): bool = all {
    not(offline.contains(person)),
    username' = username,
    shownName' = shownName,
    usernameOnDevice' = usernameOnDevice,
    notAllowed' = notAllowed,
    lastUsernameChange' = lastUsernameChange,
    offline' = offline.union(Set(person)),
    _nameAtCutOff' = _nameAtCutOff.set(person, username.get(person)),
    _resultAtCutOff' = _resultAtCutOff.set(person, lastUsernameChange.get(person)),
  }

  action connectionReturns: bool = all {
    offline != Set(),
    username' = username,
    shownName' = shownName,
    usernameOnDevice' = usernameOnDevice,
    notAllowed' = notAllowed,
    lastUsernameChange' = lastUsernameChange,
    offline' = Set(),
    _nameAtCutOff' = _nameAtCutOff,
    _resultAtCutOff' = _resultAtCutOff,
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet typed = NAMES.oneOf()
    nondet retyped = NAMES.oneOf()
    nondet name = CHANGEABLE.oneOf()
    any {
      rename(person, typed),
      renameTwice(person, typed, retyped),
      stopAllowing(name),
      startAllowing(name),
      any {
        loseConnection(person),
        connectionReturns,
      },
    }
  }

  /// No two people ever hold the same username.
  val invNamesAreUnique = PEOPLE.forall(p =>
    PEOPLE.forall(q => p == q or username.get(p) != username.get(q))
  )

  /// Each person's own device shows the name everyone else sees.
  val invDeviceShowsUsername = usernameOnDevice == shownName

  /// Everyone sees a person's username unless it is no longer allowed, and
  /// then their stand-in name: the username itself is kept.
  val invShownNameIsUsernameOrStandIn = shownName == _shown(username, notAllowed)

  /// Nobody ever sees a username that is not allowed.
  val invNotAllowedNeverShown = PEOPLE.forall(p =>
    not(notAllowed.contains(shownName.get(p)))
  )

  /// A username the rules always refuse is never saved.
  val invAlwaysRefusedNeverSaved = PEOPLE.forall(p =>
    not(ALWAYS_REFUSED.contains(username.get(p)))
  )

  /// Saved usernames are lowercase.
  val invStoredLowercase = PEOPLE.forall(p => username.get(p) != "Ann")

  /// Offline, a person keeps the username they had when the connection went.
  /// A save then shows "You're offline", or the earlier result still stands.
  val invOfflineKeepsUsername = PEOPLE.forall(p =>
    offline.contains(p) implies
      username.get(p) == _nameAtCutOff.get(p) and
      (lastUsernameChange.get(p) == _resultAtCutOff.get(p) or
        lastUsernameChange.get(p) == RefusedOffline)
  )
}
