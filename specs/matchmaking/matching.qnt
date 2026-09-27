// Waiting for a match and being matched, at any entrance.
//
// Alice (rated 1000), Bob (1050), Carol (1500) and Dave (1550) each wait for
// a match with a narrow reach (within 5 points) or a wide one (within 200).
// Alice and Bob are close enough to accept each other with wide reaches,
// and so are Carol and Dave; the two pairs are too far apart to accept each
// other at all. A person waiting may change their reach, or stop waiting.
// A matching round pairs every two people waiting who accept each other,
// and a matched person stays matched: they cannot stop waiting, and a change
// of reach does nothing for them. Once matched, or once they stop waiting,
// a person may wait for a match again.
//
// Every request lands at one of three entrances, and nobody chooses which.
// Wherever it lands the outcome is the same, and every entrance sees the
// same standing for everyone. An entrance may open again at any time; it
// changes nobody's standing.
module matching {
  type Person = str

  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol", "dave")
  /// The people close enough in rating to accept each other with wide
  /// reaches (a 50 point gap); anyone else is over 400 points apart.
  pure val CLOSE_PAIRS: Set[Set[Person]] = Set(Set("alice", "bob"), Set("carol", "dave"))
  /// The entrances a request can land at.
  pure val ENTRANCES: Set[int] = Set(1, 2, 3)

  /// How far from their own rating a person accepts someone.
  type Reach =
    | Narrow
    | Wide

  /// Where a person stands with matchmaking.
  type Standing =
    | NotWaiting
    | Waiting
    | Matched(Person)

  /// Everyone's standing, the same at every entrance.
  var standing: Person -> Standing
  /// The reach each person waits with (kept after their wait ends).
  var _reach: Person -> Reach

  pure val REACHES: Set[Reach] = Set(Narrow, Wide)

  action init = all {
    standing' = PEOPLE.mapBy(_ => NotWaiting),
    _reach' = PEOPLE.mapBy(_ => Narrow),
  }

  /// `person` waits for a match with `reach`, through `entrance`.
  action waitForMatch(person: Person, reach: Reach, entrance: int): bool = all {
    ENTRANCES.contains(entrance),
    standing.get(person) != Waiting,
    standing' = standing.set(person, Waiting),
    _reach' = _reach.set(person, reach),
  }

  /// `person` stops waiting, through `entrance`: only a wait ends; a matched
  /// person stays matched, and a person not waiting has nothing to stop.
  action stopWaiting(person: Person, entrance: int): bool = all {
    ENTRANCES.contains(entrance),
    standing' = if (standing.get(person) == Waiting) standing.set(person, NotWaiting) else standing,
    _reach' = _reach,
  }

  /// `person` changes their reach, through `entrance`: it counts only while
  /// they are waiting.
  action changeReach(person: Person, reach: Reach, entrance: int): bool = all {
    ENTRANCES.contains(entrance),
    standing.get(person) != NotWaiting,
    standing' = standing,
    _reach' = if (standing.get(person) == Waiting) _reach.set(person, reach) else _reach,
  }

  /// Two people waiting who accept each other.
  pure def _acceptEachOther(
    standing: Person -> Standing,
    reach: Person -> Reach,
    p: Person,
    q: Person,
  ): bool = and {
    p != q,
    CLOSE_PAIRS.contains(Set(p, q)),
    standing.get(p) == Waiting,
    standing.get(q) == Waiting,
    reach.get(p) == Wide,
    reach.get(q) == Wide,
  }

  /// A matching round, at `entrance`: every two people waiting who accept
  /// each other are matched.
  action matchingRound(entrance: int): bool = all {
    ENTRANCES.contains(entrance),
    standing' = PEOPLE.mapBy(p => {
      val partners = PEOPLE.filter(q => _acceptEachOther(standing, _reach, p, q))
      if (partners.size() == 1) Matched(partners.getOnlyElement()) else standing.get(p)
    }),
    _reach' = _reach,
  }

  /// `entrance` opens again: nobody's standing changes.
  action entranceOpensAgain(entrance: int): bool = all {
    ENTRANCES.contains(entrance),
    standing' = standing,
    _reach' = _reach,
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet reach = REACHES.oneOf()
    nondet entrance = ENTRANCES.oneOf()
    any {
      waitForMatch(person, reach, entrance),
      stopWaiting(person, entrance),
      changeReach(person, reach, entrance),
      matchingRound(entrance),
      entranceOpensAgain(entrance),
    }
  }

  /// A person is only ever matched with someone close enough to accept.
  val invMatchedWithinReach = PEOPLE.forall(p =>
    match standing.get(p) {
      | Matched(q) => p != q and CLOSE_PAIRS.contains(Set(p, q))
      | _ => true
    }
  )

  /// Nobody is matched with themselves.
  val invNoSelfMatch = PEOPLE.forall(p => standing.get(p) != Matched(p))
}
