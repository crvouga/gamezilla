// Changing a username.
//
// Alice and Bob are signed in; Carol is a guest with a generated username.
// Anyone can rename themselves: pick a new username and save it. The username
// change then shows one of: "Saved" (the username is theirs now), "Username
// is taken" (someone else has it, in any letter case), "Username was changed
// recently" (they renamed themselves moments ago and must wait), or "You're
// offline" (a username change needs a connection). Usernames are saved in
// lowercase, and saving the username a person already has is simply saved. A
// refused username change changes nothing, and does not count as a change. A
// person can save once and, on seeing the result, right away save another
// username.
//
// A person can lose their connection, and the connection can come back.
// The username everyone else sees for a person and the one on that person's
// own device always agree.
module username_changes {
  type Person = str

  /// Alice and Bob sign in with Google; Carol stays a guest.
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// What people type: few enough that names collide, in two letter cases.
  pure val NAMES: Set[str] = Set("ann", "Ann", "bea", "alice")

  /// A guest's first username, generated for them.
  pure val GENERATED = "generated"

  /// What each person's last username change showed them.
  type UsernameChangeResult =
    | NoUsernameChange
    | UsernameSaved
    | UsernameTaken
    | ChangedRecently
    | RefusedOffline

  /// Each person's username, as everyone else sees it.
  var username: Person -> str
  /// Each person's username, as their own device shows it.
  var usernameOnDevice: Person -> str
  /// The result of each person's last username change.
  var lastUsernameChange: Person -> UsernameChangeResult
  /// People whose device has lost the connection.
  var offline: Set[Person]

  /// How a typed username is saved.
  pure def _lowercase(name: str): str = if (name == "Ann") "ann" else name

  pure def _takenBy(names: Person -> str, person: Person, name: str): bool =
    PEOPLE.exists(other => other != person and names.get(other) == name)

  /// What a username change shows when `person` saves `typed` while the
  /// usernames are `names`; `cooling` says they changed it moments ago.
  pure def _resultOf(
    names: Person -> str,
    isOffline: bool,
    person: Person,
    typed: str,
    cooling: bool,
  ): UsernameChangeResult =
    if (isOffline) RefusedOffline
    else if (_lowercase(typed) == names.get(person)) UsernameSaved
    else if (cooling) ChangedRecently
    else if (_takenBy(names, person, _lowercase(typed))) UsernameTaken
    else UsernameSaved

  /// The usernames after that save.
  pure def _usernamesAfter(
    names: Person -> str,
    isOffline: bool,
    person: Person,
    typed: str,
    cooling: bool,
  ): Person -> str =
    if (_resultOf(names, isOffline, person, typed, cooling) == UsernameSaved)
      names.set(person, _lowercase(typed))
    else names

  action init = all {
    username' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    usernameOnDevice' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    lastUsernameChange' = PEOPLE.mapBy(_ => NoUsernameChange),
    offline' = Set(),
  }

  /// A person saves a new username, a while after anything they did before.
  action rename(person: Person, typed: str): bool = {
    val isOffline = offline.contains(person)
    val after = _usernamesAfter(username, isOffline, person, typed, false)
    all {
      username' = after,
      usernameOnDevice' = after,
      lastUsernameChange' = lastUsernameChange.set(person, _resultOf(username, isOffline, person, typed, false)),
      offline' = offline,
    }
  }

  /// A person saves `typed` and, on seeing the result, right away `retyped`.
  action renameTwice(person: Person, typed: str, retyped: str): bool = {
    val isOffline = offline.contains(person)
    val between = _usernamesAfter(username, isOffline, person, typed, false)
    val changed = between.get(person) != username.get(person)
    val after = _usernamesAfter(between, isOffline, person, retyped, changed)
    all {
      username' = after,
      usernameOnDevice' = after,
      lastUsernameChange' = lastUsernameChange.set(person, _resultOf(between, isOffline, person, retyped, changed)),
      offline' = offline,
    }
  }

  action loseConnection(person: Person): bool = all {
    not(offline.contains(person)),
    username' = username,
    usernameOnDevice' = usernameOnDevice,
    lastUsernameChange' = lastUsernameChange,
    offline' = offline.union(Set(person)),
  }

  action connectionReturns: bool = all {
    offline != Set(),
    username' = username,
    usernameOnDevice' = usernameOnDevice,
    lastUsernameChange' = lastUsernameChange,
    offline' = Set(),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet typed = NAMES.oneOf()
    nondet retyped = NAMES.oneOf()
    any {
      rename(person, typed),
      renameTwice(person, typed, retyped),
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

  /// Each person's own device shows the username everyone else sees.
  val invDeviceShowsUsername = usernameOnDevice == username

  /// Saved usernames are lowercase.
  val invStoredLowercase = PEOPLE.forall(p => username.get(p) != "Ann")
}
