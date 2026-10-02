// @spec-meta — package reference protocol fixture
// Package contract: every acknowledged cell has an authoritative durable copy.
// A rebuild stages, copies, validates, publishes, and only then removes staging.
// Crashes can happen between every pair of actions, including during recovery.
// Row identifiers and actual values are compared, not just row counts.
module rebuild_recovery {
  pure val ORIGINAL = Map("receipt_a" -> "café", "receipt_b" -> "")
  type State = {
    table: str -> str, old: str -> str, acknowledged: str -> str,
    phase: str, running: bool, ready: bool, ambiguous: bool,
    foreignKeys: bool, legacyRename: bool,
  }
  var s: State

  action init = s' = {
    table: ORIGINAL, old: Map(), acknowledged: ORIGINAL,
    phase: "ready", running: true, ready: true, ambiguous: false,
    foreignKeys: true, legacyRename: false,
  }

  /// Writes either finish before staging, or wait until a safe published state.
  action applicationWrite: bool = all {
    s.running, s.phase == "ready", not(s.table.keys().contains("receipt_c")),
    s' = { ...s, table: s.table.put("receipt_c", "saved offline"),
      acknowledged: s.acknowledged.put("receipt_c", "saved offline") },
  }

  action stage: bool = all {
    s.running, s.phase == "ready",
    s' = { ...s, old: s.table, table: Map(), phase: "staged", ready: false,
      foreignKeys: false, legacyRename: true },
  }

  action createReplacement: bool = all {
    s.running, s.phase == "staged",
    s' = { ...s, phase: "copying" },
  }

  action copyRow(row: str): bool = all {
    s.running, s.phase == "copying", s.old.keys().contains(row),
    s' = { ...s, table: s.table.put(row, s.old.get(row)) },
  }

  /// Equality compares every identifier and value, not just cardinality.
  action validate: bool = all {
    s.running, s.phase == "copying", s.table == s.old,
    s' = { ...s, phase: "validated" },
  }

  action publish: bool = all {
    s.running, s.phase == "validated", s.table == s.old,
    s' = { ...s, phase: "published", ready: true,
      foreignKeys: true, legacyRename: false },
  }

  action cleanup: bool = all {
    s.running, s.phase == "published", not(s.ambiguous), s.table == s.old,
    s' = { ...s, phase: "ready", old: Map() },
  }

  /// A process loss closes that connection; its transient settings do not leak.
  action crash: bool = all {
    s.running,
    s' = { ...s, running: false, ready: false,
      foreignKeys: true, legacyRename: false },
  }

  /// Recovery retains the staged original until a complete replacement exists.
  action recover: bool = all {
    not(s.running), not(s.ambiguous),
    s' = { ...s, running: true, ready: true, phase: "ready", old: Map(),
      table: (if (Set("staged", "copying", "validated").contains(s.phase))
        s.old else s.table), foreignKeys: true, legacyRename: false },
  }

  /// A copy failure restores the original and the same connection's settings.
  action failCopy: bool = all {
    s.running, Set("staged", "copying", "validated").contains(s.phase),
    s' = { ...s, table: s.old, old: Map(), phase: "ready", ready: true,
      foreignKeys: true, legacyRename: false },
  }

  /// An inconsistent extra row makes recovery ambiguous. Keep both copies.
  action conflictingCopy: bool = all {
    not(s.running), s.phase == "copying", not(s.ambiguous),
    s' = { ...s, ambiguous: true, table: s.table.put("unexplained", "keep me") },
  }

  action refuseAmbiguous: bool = all {
    not(s.running), s.ambiguous, s' = s,
  }

  action step = {
    nondet row = Set("receipt_a", "receipt_b", "receipt_c").oneOf()
    any { applicationWrite, stage, createReplacement, copyRow(row), validate,
      publish, cleanup, crash, recover, failCopy, conflictingCopy, refuseAmbiguous }
  }

  /// At least one durable copy contains each exact acknowledged cell.
  val invNoAcknowledgedDataLoss = s.acknowledged.keys().forall(row =>
    (s.table.keys().contains(row) and s.table.get(row) == s.acknowledged.get(row))
      or (s.old.keys().contains(row) and s.old.get(row) == s.acknowledged.get(row)))
  /// No partial table is advertised as ready for application traffic.
  val invReadyIsComplete = s.ready implies
    s.acknowledged.keys().forall(row => s.table.get(row) == s.acknowledged.get(row))
  /// Ambiguous recovery never reopens the database or removes the original.
  val invAmbiguousHolds = s.ambiguous implies
    (not(s.running) and not(s.ready) and s.old != Map())
  /// Every exit restores connection settings; only active rebuilds may differ.
  val invSettingsRestored = (not(s.running) or s.ready) implies
    (s.foreignKeys and not(s.legacyRename))
  val invKnownPhase = Set("ready", "staged", "copying", "validated", "published").contains(s.phase)

  run partialCopyRecoveryTest = init.then(applicationWrite).then(stage)
    .then(createReplacement).then(copyRow("receipt_a")).then(crash).then(recover)
    .expect(s.ready and s.table == s.acknowledged and s.old == Map())

  run publishedCopyRecoveryTest = init.then(stage).then(createReplacement)
    .then(copyRow("receipt_a")).then(copyRow("receipt_b"))
    .then(validate).then(publish).then(crash).then(recover)
    .expect(s.ready and s.table == ORIGINAL and s.foreignKeys and not(s.legacyRename))

  run interruptedRecoveryAgainTest = init.then(stage).then(crash).then(recover)
    .then(crash).then(recover).expect(s.ready and s.table == ORIGINAL)

  run ambiguityPreservesBothCopiesTest = init.then(stage).then(createReplacement)
    .then(crash).then(conflictingCopy).then(refuseAmbiguous)
    .expect(s.old == ORIGINAL and s.table.get("unexplained") == "keep me" and not(s.ready))
}
