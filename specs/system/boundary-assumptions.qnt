// @spec-meta — implementation-boundary diagnostic model
// Focused counterexamples to whole-system atomicity assumptions. Unsafe actions
// below mirror observed call/transaction boundaries, NOT injected product faults.
// Safe step checks the obligations an implementation must supply to rule them out.
module boundary_assumptions {
  pure val OPERATIONS = Set(0,1)
  var hosted: int
  var checked: Set[int]
  var events: List[int]
  var dedup: Set[int]
  var effectsPending: Set[int]
  var effectsDone: Set[int]
  var providerGeneration: int
  var providerActive: bool
  var capturedGeneration: int
  var capturedActive: bool
  var projectedActive: bool
  var violation: bool

  action init = all {
    hosted' = 0, checked' = Set(), events' = [], dedup' = Set(),
    effectsPending' = Set(), effectsDone' = Set(), providerGeneration' = 0,
    providerActive' = false, capturedGeneration' = -1, capturedActive' = false,
    projectedActive' = false, violation' = false,
  }
  action keepRoom = all { events' = events, dedup' = dedup, effectsPending' = effectsPending, effectsDone' = effectsDone }
  action keepQuota = all { hosted' = hosted, checked' = checked }
  action keepBilling = all {
    providerGeneration' = providerGeneration, providerActive' = providerActive,
    capturedGeneration' = capturedGeneration, capturedActive' = capturedActive, projectedActive' = projectedActive,
  }
  action beginCreate(id: int): bool = all {
    hosted < 1, checked' = checked.union(Set(id)), hosted' = hosted,
    keepRoom, keepBilling, violation' = violation,
  }
  action finishCreate(id: int, serialized: bool): bool = all {
    checked.contains(id), checked' = checked.exclude(Set(id)),
    hosted' = if (not(serialized) or hosted < 1) hosted + 1 else hosted,
    keepRoom, keepBilling, violation' = violation,
  }
  // append -> retry outcome -> scheduled effects are three durable boundaries.
  action appendOnly(id: int): bool = all {
    not(dedup.contains(id)), events' = events.append(id), dedup' = dedup,
    effectsPending' = effectsPending, effectsDone' = effectsDone,
    keepQuota, keepBilling, violation' = violation,
  }
  action atomicCommit(id: int): bool = all {
    not(dedup.contains(id)), events' = events.append(id), dedup' = dedup.union(Set(id)),
    effectsPending' = effectsPending.union(Set(id)), effectsDone' = effectsDone,
    keepQuota, keepBilling, violation' = violation,
  }
  action recordRetryOutcome(id: int): bool = all {
    events.indices().exists(i => events.nth(i) == id),
    dedup' = dedup.union(Set(id)), events' = events,
    effectsPending' = effectsPending, effectsDone' = effectsDone,
    keepQuota, keepBilling, violation' = violation,
  }
  action deliverEffect(id: int): bool = all {
    effectsPending.contains(id), effectsPending' = effectsPending.exclude(Set(id)),
    effectsDone' = effectsDone.union(Set(id)), events' = events, dedup' = dedup,
    keepQuota, keepBilling, violation' = violation,
  }
  action providerChanges(active: bool): bool = all {
    providerGeneration' = providerGeneration + 1, providerActive' = active,
    capturedGeneration' = capturedGeneration, capturedActive' = capturedActive,
    projectedActive' = active, keepQuota, keepRoom, violation' = violation,
  }
  action readProvider: bool = all {
    capturedGeneration' = providerGeneration, capturedActive' = providerActive,
    providerGeneration' = providerGeneration, providerActive' = providerActive,
    projectedActive' = projectedActive, keepQuota, keepRoom, violation' = violation,
  }
  action projectProvider(fenced: bool): bool = all {
    capturedGeneration >= 0,
    projectedActive' = if (not(fenced) or capturedGeneration == providerGeneration) capturedActive else projectedActive,
    violation' = (violation or (not(fenced) and capturedGeneration < providerGeneration and capturedActive and not(providerActive))),
    capturedGeneration' = capturedGeneration, capturedActive' = capturedActive,
    providerGeneration' = providerGeneration, providerActive' = providerActive, keepQuota, keepRoom,
  }
  // An isolate restart preserves durable state; no missing retry record appears.
  action restart = all { keepRoom, keepQuota, keepBilling, violation' = violation }
  action step = {
    nondet id = OPERATIONS.oneOf()
    nondet active = Set(false,true).oneOf()
    any { beginCreate(id), finishCreate(id,true), atomicCommit(id), deliverEffect(id),
      providerChanges(active), readProvider, projectProvider(true), restart }
  }
  val invSafety = and {
    hosted <= 1,
    events.length() == events.foldl(Set(),(xs,id) => xs.union(Set(id))).size(),
    dedup == effectsPending.union(effectsDone), effectsPending.intersect(effectsDone) == Set(),
    not(violation),
  }
  run unprotectedCountRaceTest = init.then(beginCreate(0)).then(beginCreate(1))
    .then(finishCreate(0,false)).then(finishCreate(1,false)).expect(hosted == 2)
  run missingAtomicLogOutcomeTest = init.then(appendOnly(0)).then(restart)
    .then(appendOnly(0)).expect(events == [0,0] and dedup == Set())
  run missingDurableEffectTest = init.then(appendOnly(0)).then(recordRetryOutcome(0))
    .then(restart).expect(dedup.contains(0) and not(effectsPending.contains(0)) and not(effectsDone.contains(0)))
  run staleProviderReadTest = init.then(providerChanges(true)).then(readProvider)
    .then(providerChanges(false)).then(projectProvider(false)).expect(violation and projectedActive)
}
