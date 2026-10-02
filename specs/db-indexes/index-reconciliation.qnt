// Package contract: only proven-owned ordinary indexes may retire or disappear.
// Retirement requires a complete quiet window, current demand, trustworthy
// usage, and an unchanged evidence generation checked at execution time.
// Invalid builds, resource exhaustion, and crashes are never full convergence.
module index_reconciliation {
  pure val PROTECTED = Set("manual", "primary", "unique_autoidx", "exclusion_autoidx", "ix", "ux")
  // Abstract ticks: WINDOW stands for the configured window, not real days.
  pure val WINDOW = 2
  type State = {
    valid: Set[str], invalid: Set[str], desired: bool,
    retiring: bool, age: int, usage: int, baseline: int, trusted: bool,
    generation: int, planned: int, plannedDrop: bool,
    running: bool, budget: int, result: str, dropSafe: bool,
    protected: Set[str], rows: str -> str,
  }
  var s: State

  action init = s' = {
    valid: Set("old"), invalid: Set(), desired: true,
    retiring: false, age: 0, usage: 0, baseline: 0, trusted: true,
    generation: 0, planned: 0, plannedDrop: false,
    running: true, budget: 3, result: "pending", dropSafe: true,
    protected: PROTECTED, rows: Map("receipt_a" -> "café", "receipt_b" -> ""),
  }

  /// A build can leave an invalid artifact; it is never usable coverage.
  action startBuild: bool = all {
    s.running, s.budget > 0, s.desired,
    not(s.valid.contains("replacement")), not(s.invalid.contains("replacement")),
    s' = { ...s, invalid: s.invalid.union(Set("replacement")),
      budget: s.budget - 1, result: "pending" },
  }

  action finishBuild: bool = all {
    s.running, s.budget > 0, s.invalid.contains("replacement"),
    s' = { ...s, invalid: s.invalid.exclude(Set("replacement")),
      valid: s.valid.union(Set("replacement")), budget: s.budget - 1 },
  }

  action failBuild: bool = all {
    s.running, s.invalid.contains("replacement"),
    s' = { ...s, result: "build failed" },
  }

  /// Demand changes invalidate any previously planned drop.
  action changeDemand: bool = all {
    s.generation < 3,
    s' = { ...s, desired: not(s.desired), generation: s.generation + 1,
      result: "pending" },
  }

  /// Keep old coverage until replacement exists if the workload still needs it.
  action beginRetirement: bool = all {
    s.running, s.budget > 0, s.valid.contains("old"), not(s.retiring), s.trusted,
    not(s.desired) or s.valid.contains("replacement"),
    s' = { ...s, retiring: true, age: 0, baseline: s.usage,
      budget: s.budget - 1 },
  }

  /// Renewed old-index demand is represented by losing replacement coverage.
  action cancelRetirement: bool = all {
    s.running, s.retiring, s.desired, not(s.valid.contains("replacement")),
    s' = { ...s, retiring: false, age: 0, plannedDrop: false },
  }

  action tick: bool = all {
    s.retiring, s.age < WINDOW,
    s' = { ...s, age: s.age + 1 },
  }

  /// Usage can change even after a drop has been planned.
  action useOld: bool = all {
    s.valid.contains("old"), s.usage < 3, s.generation < 3,
    s' = { ...s, usage: s.usage + 1, generation: s.generation + 1 },
  }

  action refreshWindow: bool = all {
    s.running, s.retiring, s.usage != s.baseline,
    s' = { ...s, baseline: s.usage, age: 0, plannedDrop: false },
  }

  /// Unavailable, reset, or malformed evidence is conservatively untrusted.
  action loseEvidence: bool = all {
    s.trusted, s.generation < 3,
    s' = { ...s, trusted: false, generation: s.generation + 1 },
  }

  action restoreEvidence: bool = all {
    not(s.trusted), s.generation < 3,
    s' = { ...s, trusted: true, age: 0, baseline: s.usage,
      plannedDrop: false, generation: s.generation + 1 },
  }

  val eligible = and {
    s.valid.contains("old"), s.retiring, s.age >= WINDOW,
    s.trusted, s.usage == s.baseline,
    not(s.desired) or s.valid.contains("replacement"),
  }

  action planDrop: bool = all {
    s.running, eligible,
    s' = { ...s, planned: s.generation, plannedDrop: true },
  }

  /// Check the evidence again at the operation boundary, under coordination.
  action executeDrop: bool = all {
    s.running, s.budget > 0, s.plannedDrop,
    if (eligible and s.planned == s.generation)
      s' = { ...s, valid: s.valid.exclude(Set("old")), retiring: false,
        plannedDrop: false, budget: s.budget - 1,
        dropSafe: eligible and s.planned == s.generation }
    else s' = { ...s, plannedDrop: false, result: "stale evidence" },
  }

  action exhaustBudget: bool = all {
    s.running, s' = { ...s, budget: 0, result: "incomplete" },
  }

  action crash: bool = all {
    s.running, s' = { ...s, running: false, result: "interrupted" },
  }

  /// A fresh run discards ephemeral plans; durable catalog and metadata survive.
  action restart: bool = all {
    not(s.running),
    s' = { ...s, running: true, budget: 3, plannedDrop: false, result: "pending" },
  }

  action reportSuccess: bool = all {
    s.running, s.invalid == Set(),
    not(s.desired) or s.valid.contains("replacement"),
    s' = { ...s, result: "success" },
  }

  action step = any {
    startBuild, finishBuild, failBuild, changeDemand, beginRetirement,
    cancelRetirement, tick, useOld, refreshWindow, loseEvidence,
    restoreEvidence, planDrop, executeDrop, exhaustBudget, crash, restart, reportSuccess,
  }

  val invProtectedUnchanged = s.protected == PROTECTED
  val invDomainDataUnchanged = s.rows == Map("receipt_a" -> "café", "receipt_b" -> "")
  val invOnlyOwnedObjects = s.valid.union(s.invalid).subseteq(Set("old", "replacement"))
  val invBuildStateDisjoint = s.valid.intersect(s.invalid) == Set()
  val invEveryDropProvenSafe = s.dropSafe
  val invSuccessIsTruthful = s.result == "success" implies
    (s.invalid == Set() and (not(s.desired) or s.valid.contains("replacement")))
  val invFiniteBudgets = s.budget >= 0 and s.budget <= 3 and s.age <= WINDOW

  run completeQuietWindowDropTest = init.then(changeDemand).then(beginRetirement)
    .then(tick).then(tick).then(planDrop).then(executeDrop)
    .expect(not(s.valid.contains("old")) and s.dropSafe)

  run useAfterPlanningPreventsDropTest = init.then(changeDemand).then(beginRetirement)
    .then(tick).then(tick).then(planDrop).then(useOld).then(executeDrop)
    .expect(s.valid.contains("old") and s.result == "stale evidence")

  run demandAfterPlanningPreventsDropTest = init.then(changeDemand).then(beginRetirement)
    .then(tick).then(tick).then(planDrop).then(changeDemand).then(executeDrop)
    .expect(s.valid.contains("old") and s.result == "stale evidence")

  run failedBuildKeepsOldCoverageTest = init.then(startBuild).then(failBuild)
    .then(crash).then(restart).expect(s.valid.contains("old") and s.result != "success")

  run freshRunRepairsInvalidBuildTest = init.then(startBuild).then(crash).then(restart)
    .then(finishBuild).then(reportSuccess)
    .expect(s.valid.contains("replacement") and s.invalid == Set() and s.result == "success")

  run usageRestartsFullWindowTest = init.then(changeDemand).then(beginRetirement)
    .then(tick).then(useOld).then(refreshWindow)
    .expect(s.age == 0 and s.baseline == s.usage and s.valid.contains("old"))

  run renewedDemandIsPendingUntilBuiltTest = init.then(changeDemand).then(beginRetirement)
    .then(tick).then(tick).then(planDrop).then(executeDrop).then(changeDemand)
    .expect(s.result == "pending" and not(s.valid.contains("replacement")))
}
