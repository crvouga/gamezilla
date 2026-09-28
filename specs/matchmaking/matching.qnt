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

  pure val RANGES: Set[RatingRange] = Set(Narrow, Wide)

  action init = all {
    standing' = PEOPLE.mapBy(_ => NotWaiting),
    _range' = PEOPLE.mapBy(_ => Narrow),
  }

  /// `person` waits for a match with `range`; while already waiting, they
  /// are told so and nothing changes.
  action waitForMatch(person: Person, range: RatingRange): bool = all {
    standing' = if (standing.get(person) == Waiting) standing else standing.set(person, Waiting),
    _range' = if (standing.get(person) == Waiting) _range else _range.set(person, range),
  }

  /// `person` stops waiting: only a wait ends; a matched person stays
  /// matched, and a person not waiting has nothing to stop.
  action stopWaiting(person: Person): bool = all {
    standing' = if (standing.get(person) == Waiting) standing.set(person, NotWaiting) else standing,
    _range' = _range,
  }

  /// `person` changes their range: it counts only while they are waiting.
  action changeRange(person: Person, range: RatingRange): bool = all {
    standing' = standing,
    _range' = if (standing.get(person) == Waiting) _range.set(person, range) else _range,
  }

  /// Two people waiting who accept each other.
  pure def _acceptEachOther(
    standing: Person -> Standing,
    range: Person -> RatingRange,
    p: Person,
    q: Person,
  ): bool = and {
    p != q,
    CLOSE_PAIRS.contains(Set(p, q)),
    standing.get(p) == Waiting,
    standing.get(q) == Waiting,
    range.get(p) == Wide,
    range.get(q) == Wide,
  }

  /// Matchmaking pairs up every two people waiting who accept each other.
  action pairUp: bool = all {
    standing' = PEOPLE.mapBy(p => {
      val partners = PEOPLE.filter(q => _acceptEachOther(standing, _range, p, q))
      if (partners.size() == 1) Matched(partners.getOnlyElement()) else standing.get(p)
    }),
    _range' = _range,
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet range = RANGES.oneOf()
    any {
      waitForMatch(person, range),
      stopWaiting(person),
      changeRange(person, range),
      pairUp,
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
}
