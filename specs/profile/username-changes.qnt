// Changing a username.
//
// Alice and Bob are signed in; Carol is a guest with a generated username.
// Anyone can pick a new username and save it. The save button then says one
// of: "Saved" (the name is theirs now), "Username is taken" (someone else
// has it, in any letter case), "Username was changed recently" (they
// changed their name moments ago and must wait), or "You're offline" (saving
// a username needs a connection). Names are stored in lowercase, and saving
// the name a person already has is simply saved. A refused save changes
// nothing, and does not count as a change. A person can save once and, on
// seeing the answer, right away save another name.
//
// A person can lose their connection, and the connection can come back.
// Each person's device and the server always agree on that person's name.
module username_changes {
  type Person = str

  /// Alice and Bob sign in with Google; Carol stays a guest.
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// What people type: few enough that names collide, in two letter cases.
  pure val NAMES: Set[str] = Set("ann", "Ann", "bea", "alice")

  /// A guest's first username, generated for them.
  pure val GENERATED = "generated"

  /// What the save button last said to each person.
  type Answer =
    | NoAnswer
    | Saved
    | Taken
    | ChangedRecently
    | Offline

  /// Each person's username, as the server holds it.
  var server: Person -> str
  /// Each person's username, as their own device holds it.
  var device: Person -> str
  /// The save button's last answer to each person.
  var answer: Person -> Answer
  /// People whose device has lost the connection.
  var offline: Set[Person]

  /// How a typed name is stored.
  pure def lower(name: str): str = if (name == "Ann") "ann" else name

  pure def takenBy(names: Person -> str, person: Person, name: str): bool =
    PEOPLE.exists(other => other != person and names.get(other) == name)

  /// What the save button says when `person` saves `typed` while the
  /// usernames are `names`; `cooling` says they changed it moments ago.
  pure def answerTo(
    names: Person -> str,
    isOffline: bool,
    person: Person,
    typed: str,
    cooling: bool,
  ): Answer =
    if (isOffline) Offline
    else if (lower(typed) == names.get(person)) Saved
    else if (cooling) ChangedRecently
    else if (takenBy(names, person, lower(typed))) Taken
    else Saved

  /// The usernames after that save.
  pure def namesAfter(
    names: Person -> str,
    isOffline: bool,
    person: Person,
    typed: str,
    cooling: bool,
  ): Person -> str =
    if (answerTo(names, isOffline, person, typed, cooling) == Saved)
      names.set(person, lower(typed))
    else names

  action init = all {
    server' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    device' = Map("alice" -> "alice", "bob" -> "bob", "carol" -> GENERATED),
    answer' = PEOPLE.mapBy(_ => NoAnswer),
    offline' = Set(),
  }

  /// A person saves a new username, a while after anything they did before.
  action rename(person: Person, typed: str): bool = {
    val isOffline = offline.contains(person)
    val after = namesAfter(server, isOffline, person, typed, false)
    all {
      server' = after,
      device' = after,
      answer' = answer.set(person, answerTo(server, isOffline, person, typed, false)),
      offline' = offline,
    }
  }

  /// A person saves `typed` and, on seeing the answer, right away `retyped`.
  action renameTwice(person: Person, typed: str, retyped: str): bool = {
    val isOffline = offline.contains(person)
    val between = namesAfter(server, isOffline, person, typed, false)
    val changed = between.get(person) != server.get(person)
    val after = namesAfter(between, isOffline, person, retyped, changed)
    all {
      server' = after,
      device' = after,
      answer' = answer.set(person, answerTo(between, isOffline, person, retyped, changed)),
      offline' = offline,
    }
  }

  action loseConnection(person: Person): bool = all {
    not(offline.contains(person)),
    server' = server,
    device' = device,
    answer' = answer,
    offline' = offline.union(Set(person)),
  }

  action connectionReturns: bool = all {
    offline != Set(),
    server' = server,
    device' = device,
    answer' = answer,
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
    PEOPLE.forall(q => p == q or server.get(p) != server.get(q))
  )

  /// Each device holds what the server holds for its person.
  val invDeviceMatchesServer = device == server

  /// Stored names are lowercase.
  val invStoredLowercase = PEOPLE.forall(p => server.get(p) != "Ann")
}
