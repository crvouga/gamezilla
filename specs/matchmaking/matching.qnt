// Waiting for a match and being matched.
//
// Alice (rated 1000), Bob (1050), Carol (1500) and Dave (1550) each wait for
// a match accepting anyone within 5 points of their rating (a narrow range)
// or within 200 points (a wide one). Alice and Bob are close enough to
// accept each other with wide ranges, and so are Carol and Dave; the two
// pairs are too far apart ever to accept each other.
//
// A person waits for one match at a time: asking again while waiting
// changes nothing. A person waiting may change their range, or stop
// waiting. Every so often matchmaking pairs up every two people waiting who
// accept each other, and a matched person stays matched: they cannot stop
// waiting, and changing their range does nothing for them. Once matched, or
// once they stop waiting, a person may wait for a match again.
//
// A person with no connection cannot wait, stop waiting or change their
// range. Matchmaking can still pair two people who are waiting.
module matching {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol", "dave")
  /// The people close enough in rating to accept each other with wide
  /// ranges (a 50 point gap); anyone else is over 400 points apart.
  pure val CLOSE_PAIRS: Set[Set[Person]] = Set(Set("alice", "bob"), Set("carol", "dave"))

  /// How far from their own rating a person accepts someone.
  type RatingRange =
    | Narrow
    | Wide

  /// Where a person stands with matchmaking.
  type Standing =
    | NotWaiting
    | Waiting
    | Matched(Person)

  /// Everyone's standing.
  var standing: Person -> Standing
  /// The range each person waits with (kept after their wait ends).
  var _range: Person -> RatingRange
  /// People whose device has no connection.
  var _offline: Set[Person]
  /// How many times each person has waited, stopped or changed their range,
  /// and how many when their connection went.
  var _done: Person -> int
  var _doneAtCutOff: Person -> int

  pure val RANGES: Set[RatingRange] = Set(Narrow, Wide)

  action init = all {
    standing' = PEOPLE.mapBy(_ => NotWaiting),
    _range' = PEOPLE.mapBy(_ => Narrow),
    _offline' = Set(),
    _done' = PEOPLE.mapBy(_ => 0),
    _doneAtCutOff' = PEOPLE.mapBy(_ => 0),
  }

  def _acted(person: Person): Person -> int =
    _done.set(person, _done.get(person) + 1)

  /// `person` waits for a match with `ratingRange`; while already waiting, they
  /// are told so and nothing changes.
  action waitForMatch(person: Person, ratingRange: RatingRange): bool = all {
    not(_offline.contains(person)),
    standing' = if (standing.get(person) == Waiting) standing else standing.set(person, Waiting),
    _range' = if (standing.get(person) == Waiting) _range else _range.set(person, ratingRange),
    _offline' = _offline,
    _done' = _acted(person),
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// `person` stops waiting: only a wait ends; a matched person stays
  /// matched, and a person not waiting has nothing to stop.
  action stopWaiting(person: Person): bool = all {
    not(_offline.contains(person)),
    standing' = if (standing.get(person) == Waiting) standing.set(person, NotWaiting) else standing,
    _range' = _range,
    _offline' = _offline,
    _done' = _acted(person),
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// `person` changes their range: it counts only while they are waiting.
  action changeRange(person: Person, ratingRange: RatingRange): bool = all {
    not(_offline.contains(person)),
    standing' = standing,
    _range' = if (standing.get(person) == Waiting) _range.set(person, ratingRange) else _range,
    _offline' = _offline,
    _done' = _acted(person),
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// Two people waiting who accept each other.
  pure def _acceptEachOther(
    standing: Person -> Standing,
    ranges: Person -> RatingRange,
    p: Person,
    q: Person,
  ): bool = and {
    p != q,
    CLOSE_PAIRS.contains(Set(p, q)),
    standing.get(p) == Waiting,
    standing.get(q) == Waiting,
    ranges.get(p) == Wide,
    ranges.get(q) == Wide,
  }

  /// Matchmaking pairs up every two people waiting who accept each other.
  /// Each person is close to exactly one other, so they have at most one
  /// partner.
  action pairUp: bool = all {
    standing' = PEOPLE.mapBy(p => {
      val partners = PEOPLE.filter(q => _acceptEachOther(standing, _range, p, q))
      if (partners.size() == 1) Matched(partners.fold(p, (_, q) => q)) else standing.get(p)
    }),
    _range' = _range,
    _offline' = _offline,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// `person`'s device loses its connection.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    standing' = standing,
    _range' = _range,
    _offline' = _offline.union(Set(person)),
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff.set(person, _done.get(person)),
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    standing' = standing,
    _range' = _range,
    _offline' = Set(),
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet ratingRange = RANGES.oneOf()
    any {
      waitForMatch(person, ratingRange),
      stopWaiting(person),
      changeRange(person, ratingRange),
      pairUp,
      _loseConnection(person),
      _connectionReturns,
    }
  }

  /// A person is only ever matched with someone close enough to accept.
  val invMatchedWithinRange = PEOPLE.forall(p =>
    match standing.get(p) {
      | Matched(q) => p != q and CLOSE_PAIRS.contains(Set(p, q))
      | _ => true
    }
  )

  /// Nobody is matched with themselves.
  val invNoSelfMatch = PEOPLE.forall(p => standing.get(p) != Matched(p))

  /// With no connection, a person waits, stops and changes their range no
  /// further time. Matchmaking may still pair them.
  val invOfflineDoesNoMore = PEOPLE.forall(p =>
    _offline.contains(p) implies _done.get(p) == _doneAtCutOff.get(p)
  )
}
