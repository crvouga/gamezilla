// Index tuning, as the team sees it.
//
// The team declares which lookups the product makes: notes by author, notes
// by owner, both, or none. Whenever tuning runs, every declared lookup that
// has no tuned index gets one. A tuned index no declared lookup needs starts
// retiring: it stays, and a lookup still using it keeps working. Tuning
// removes a retiring index only once a whole retirement window (one day
// here) has passed without it being used; each use starts the window again,
// and declaring its lookup again ends its retirement. The team can see how
// many times each tuned index has been used, and can keep an index of its
// own, which tuning never retires or removes however long it goes unused.
// Tuning again with nothing new to do changes nothing.
module index_tuning {
  type Lookup =
    | NotesByAuthor
    | NotesByOwner

  pure val LOOKUPS: Set[Lookup] = Set(NotesByAuthor, NotesByOwner)
  /// How long a retiring index must go unused before tuning removes it.
  pure val RETIREMENT_WINDOW_DAYS: int = 1
  /// How many days may pass at once: less than a window, one, and many.
  pure val DAYS: Set[int] = Set(1, 2, 40)

  /// The lookups the team declares.
  var declared: Set[Lookup]
  /// The lookups that have a tuned index.
  var tuned: Set[Lookup]
  /// The lookups whose tuned index is retiring.
  var retiring: Set[Lookup]
  /// How many times each tuned index has been used.
  var uses: Lookup -> int
  /// Whether the team's own index is there.
  var teamIndex: bool

  /// Today, counted in days.
  var _today: int
  /// The day each retiring index's retirement window began.
  var _windowStart: Lookup -> int
  /// How many times each retiring index had been used when its window began.
  var _usesAtWindowStart: Lookup -> int

  action init = all {
    declared' = Set(),
    tuned' = Set(),
    retiring' = Set(),
    uses' = Map(),
    teamIndex' = false,
    _today' = 0,
    _windowStart' = Map(),
    _usesAtWindowStart' = Map(),
  }

  /// The team declares exactly `lookups`; nothing else changes until
  /// tuning runs.
  action declare(lookups: Set[Lookup]): bool = all {
    declared' = lookups,
    tuned' = tuned,
    retiring' = retiring,
    uses' = uses,
    teamIndex' = teamIndex,
    _today' = _today,
    _windowStart' = _windowStart,
    _usesAtWindowStart' = _usesAtWindowStart,
  }

  action tune: bool = {
    // Retiring indexes used since their window began: kept, window restarts.
    val usedSince = retiring.filter(l => uses.get(l) > _usesAtWindowStart.get(l))
    val added = declared.exclude(tuned)
    val startsRetiring = tuned.exclude(declared).exclude(retiring)
    val removed = retiring.exclude(declared).exclude(usedSince).filter(l =>
      _today - _windowStart.get(l) >= RETIREMENT_WINDOW_DAYS
    )
    val stillRetiring = retiring.exclude(declared).exclude(removed).union(startsRetiring)
    val windowRestarts = startsRetiring.union(usedSince)
    val newTuned = tuned.union(added).exclude(removed)
    all {
      declared' = declared,
      tuned' = newTuned,
      retiring' = stillRetiring,
      uses' = newTuned.mapBy(l => if (added.contains(l)) 0 else uses.get(l)),
      teamIndex' = teamIndex,
      _today' = _today,
      _windowStart' = stillRetiring.mapBy(l =>
        if (windowRestarts.contains(l)) _today else _windowStart.get(l)
      ),
      _usesAtWindowStart' = stillRetiring.mapBy(l =>
        if (windowRestarts.contains(l)) uses.get(l) else _usesAtWindowStart.get(l)
      ),
    }
  }

  /// `lookup` finds its answer through its tuned index once.
  action use(lookup: Lookup): bool = all {
    tuned.contains(lookup),
    declared' = declared,
    tuned' = tuned,
    retiring' = retiring,
    uses' = uses.set(lookup, uses.get(lookup) + 1),
    teamIndex' = teamIndex,
    _today' = _today,
    _windowStart' = _windowStart,
    _usesAtWindowStart' = _usesAtWindowStart,
  }

  action daysPass(days: int): bool = all {
    declared' = declared,
    tuned' = tuned,
    retiring' = retiring,
    uses' = uses,
    teamIndex' = teamIndex,
    _today' = _today + days,
    _windowStart' = _windowStart,
    _usesAtWindowStart' = _usesAtWindowStart,
  }

  /// The team adds an index of its own.
  action keepOwnIndex: bool = all {
    not(teamIndex),
    declared' = declared,
    tuned' = tuned,
    retiring' = retiring,
    uses' = uses,
    teamIndex' = true,
    _today' = _today,
    _windowStart' = _windowStart,
    _usesAtWindowStart' = _usesAtWindowStart,
  }

  action step = {
    nondet lookups = LOOKUPS.powerset().oneOf()
    nondet lookup = LOOKUPS.oneOf()
    nondet days = DAYS.oneOf()
    any {
      declare(lookups),
      tune,
      use(lookup),
      daysPass(days),
      keepOwnIndex,
    }
  }

  /// Only a tuned index retires.
  val invOnlyTunedRetire = retiring.subseteq(tuned)
  /// The team sees a use count for every tuned index and no other.
  val invUsesForEveryTunedIndex = uses.keys() == tuned
  /// Every retiring index has a retirement window that has already begun.
  val invWindowBegun = retiring.forall(l => all {
    _windowStart.keys().contains(l),
    _windowStart.get(l) <= _today,
    uses.get(l) >= _usesAtWindowStart.get(l),
  })
}
