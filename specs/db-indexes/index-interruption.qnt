// @model-profile: maintenance
// Commit ambiguity during creation, including an invalid partial build.
// Recovery uses fresh database introspection, never the old action list.
// One desired non-unique index; the operator's index must survive every step.
module index_interruption {
  var state: str
  var unfinished: bool
  var deferred: bool
  var failed: bool
  var completed: bool
  var protectedIndex: bool
  var _interrupted: bool

  action init = all {
    state' = "absent", unfinished' = false, deferred' = false,
    failed' = false, completed' = false, protectedIndex' = true, _interrupted' = false,
  }

  /// The database can fail before commit, commit without acknowledgement,
  /// or leave an invalid build. Contention and rejection are separate outcomes.
  action attempt(outcome: str): bool = all {
    state == "absent", not(completed),
    state' = if (outcome == "after" or outcome == "success") "valid"
             else if (outcome == "invalid") "invalid" else "absent",
    unfinished' = Set("before", "after", "invalid").contains(outcome),
    deferred' = outcome == "deferred", failed' = outcome == "failed",
    completed' = outcome == "success", protectedIndex' = protectedIndex,
    _interrupted' = Set("before", "after", "invalid").contains(outcome),
  }

  /// With faults removed and enough repair/build budget, one fresh run converges.
  /// This is conditional recovery, not eventual success under permanent failure.
  action recover = all {
    not(completed),
    state' = "valid", unfinished' = false, deferred' = false,
    failed' = false, completed' = true, protectedIndex' = protectedIndex, _interrupted' = false,
  }

  /// A stable completed workload can be reconciled repeatedly without writes.
  action repeat = all {
    completed, state' = state, unfinished' = unfinished, deferred' = deferred,
    failed' = failed, completed' = completed, protectedIndex' = protectedIndex,
    _interrupted' = _interrupted,
  }

  action step = {
    nondet outcome = Set("before", "after", "invalid", "deferred", "failed", "success").oneOf()
    any { attempt(outcome), recover, repeat }
  }

  val invKnownState = Set("absent", "invalid", "valid").contains(state)
  val invNoFalseCompletion = completed implies (state == "valid" and not(unfinished or deferred or failed))
  val invCrashRemainsUnfinished = _interrupted implies (unfinished and not(completed))
  val invProtectedIndexSurvives = protectedIndex
}
