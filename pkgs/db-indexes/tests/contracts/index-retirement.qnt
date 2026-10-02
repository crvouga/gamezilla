// Technical contract for a reconciler over the notes example workload.
// Two independent lookup paths, one-day virtual retirement windows.
// The implementation binding checks indexes, usage and metadata after EVERY action.
// This models observed usage between runs; use racing with the final drop is
// deliberately outside this model and remains a separate safety obligation.
module index_retirement {
  pure val LOOKUPS = Set("notesByAuthor", "notesByOwner")
  var declared: Set[str]
  var indexed: Set[str]
  var retiring: Set[str]
  var uses: str -> int
  var day: int
  var windowStart: str -> int
  var baseline: str -> int
  var teamIndex: bool
  var _teamAdded: bool
  var _held: Set[str]
  var _dropEvidence: str -> { age: int, unused: bool, desired: bool }

  action init = all {
    declared' = Set(), indexed' = Set(), retiring' = Set(),
    uses' = Map(), day' = 0, windowStart' = Map(), baseline' = Map(),
    teamIndex' = false, _teamAdded' = false, _held' = Set(), _dropEvidence' = Map(),
  }

  /// A workload may disappear, return, or change to a different lookup.
  action declare(wanted: Set[str]): bool = all {
    declared' = wanted, indexed' = indexed, retiring' = retiring,
    uses' = uses, day' = day, windowStart' = windowStart, baseline' = baseline,
    teamIndex' = teamIndex, _teamAdded' = _teamAdded,
    _held' = _held, _dropEvidence' = _dropEvidence,
  }

  /// One run creates, clears retirement, starts retirement, refreshes use,
  /// or removes an expired unused index. Its oracle is independent of SQL.
  action tune = {
    val usedSince = retiring.filter(l => uses.get(l) > baseline.get(l))
    val removed = retiring.filter(l => all {
      not(declared.contains(l)), uses.get(l) == baseline.get(l),
      day - windowStart.get(l) >= 1,
    })
    val added = declared.exclude(indexed)
    val starts = indexed.exclude(declared).exclude(retiring)
    val nextIndexed = indexed.union(added).exclude(removed)
    val nextRetiring = retiring.exclude(declared).exclude(removed).union(starts)
    val refresh = starts.union(usedSince)
    all {
      declared' = declared,
      indexed' = nextIndexed,
      retiring' = nextRetiring,
      uses' = nextIndexed.mapBy(l => if (added.contains(l)) 0 else uses.get(l)),
      day' = day,
      windowStart' = nextRetiring.mapBy(l => if (refresh.contains(l)) day else windowStart.get(l)),
      baseline' = nextRetiring.mapBy(l => if (refresh.contains(l)) uses.get(l) else baseline.get(l)),
      teamIndex' = teamIndex, _teamAdded' = _teamAdded,
      _held' = usedSince,
      _dropEvidence' = removed.mapBy(l => {
        age: day - windowStart.get(l),
        unused: uses.get(l) == baseline.get(l),
        desired: declared.contains(l),
      }),
    }
  }

  /// Use may occur at any point between runs, including at an expired window.
  action use(lookup: str): bool = all {
    indexed.contains(lookup), uses.get(lookup) < 3,
    uses' = uses.set(lookup, uses.get(lookup) + 1),
    declared' = declared, indexed' = indexed, retiring' = retiring,
    day' = day, windowStart' = windowStart, baseline' = baseline,
    teamIndex' = teamIndex, _teamAdded' = _teamAdded,
    _held' = _held, _dropEvidence' = _dropEvidence,
  }

  /// Zero days tests idempotence; one and many test both expiry and long gaps.
  action daysPass(days: int): bool = all {
    day + days <= 60, day' = day + days,
    declared' = declared, indexed' = indexed, retiring' = retiring,
    uses' = uses, windowStart' = windowStart, baseline' = baseline,
    teamIndex' = teamIndex, _teamAdded' = _teamAdded,
    _held' = _held, _dropEvidence' = _dropEvidence,
  }

  /// An operator's index is outside automatic ownership for its whole life.
  action keepOwnIndex = all {
    not(teamIndex), teamIndex' = true, _teamAdded' = true,
    declared' = declared, indexed' = indexed, retiring' = retiring,
    uses' = uses, day' = day, windowStart' = windowStart, baseline' = baseline,
    _held' = _held, _dropEvidence' = _dropEvidence,
  }

  action step = {
    nondet wanted = LOOKUPS.powerset().oneOf()
    nondet lookup = LOOKUPS.oneOf()
    nondet days = Set(0, 1, 2, 40).oneOf()
    any { declare(wanted), tune, use(lookup), daysPass(days), keepOwnIndex }
  }

  /// Retirement and usage have no dangling or missing entries.
  val invStateConsistent = all {
    indexed.forall(l => LOOKUPS.contains(l)), declared.forall(l => LOOKUPS.contains(l)),
    retiring.forall(l => indexed.contains(l)), uses.keys() == indexed,
    windowStart.keys() == retiring, baseline.keys() == retiring,
    retiring.forall(l => windowStart.get(l) <= day and baseline.get(l) <= uses.get(l)),
  }

  /// Newly observed use prevents removal, even when the old window expired.
  val invObservedUsePreserved = _held.forall(l => indexed.contains(l))

  /// Every removal is audited against facts from BEFORE that run.
  val invDropsAuthorized = _dropEvidence.keys().forall(l => all {
    _dropEvidence.get(l).age >= 1,
    _dropEvidence.get(l).unused,
    not(_dropEvidence.get(l).desired),
    not(indexed.contains(l)),
  })

  /// Automatic tuning never removes an operator's index.
  val invForeignPreserved = _teamAdded implies teamIndex
}
