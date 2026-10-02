// Package contract: schema transactions are serialized and publish atomically.
// Two reconcilers contend for one lock. A crash at any staged edit discards
// only uncommitted work. Concrete values distinguish NULL from an empty string.
// This is a reference protocol, not a proof about a database adapter.
module reconciliation_transaction {
  pure val ROWS = Set("receipt_a", "receipt_b")
  pure val ORIGINAL = Map("receipt_a" -> "café", "receipt_b" -> "")
  pure val BLANK = ROWS.mapBy(_ => "<NULL>")
  type State = {
    columns: Set[str], memo: str -> str, retired: Set[str],
    stagedColumns: Set[str], stagedMemo: str -> str, stagedRetired: Set[str],
    owner: int, generation: int, acquiredAt: int,
    acknowledged: str -> str, result: str,
  }
  var s: State

  action init = s' = {
    columns: Set("old_memo"), memo: BLANK, retired: Set(),
    stagedColumns: Set("old_memo"), stagedMemo: BLANK, stagedRetired: Set(),
    owner: 0, generation: 0, acquiredAt: 0,
    acknowledged: BLANK, result: "idle",
  }

  /// Acquire and introspect inside the lock, never from a stale pre-lock plan.
  action acquire(who: int): bool = all {
    Set(1, 2).contains(who), s.owner == 0,
    s' = { ...s, owner: who, acquiredAt: s.generation,
      stagedColumns: s.columns, stagedMemo: s.memo,
      stagedRetired: s.retired, result: "running" },
  }

  /// Contention has no catalog effect; the waiter must acquire afresh.
  action refuseContender(who: int): bool = all {
    Set(1, 2).contains(who), s.owner != 0, s.owner != who,
    s' = { ...s, result: "lock unavailable" },
  }

  action stageAdd: bool = all {
    s.owner != 0, not(s.stagedColumns.contains("memo")),
    s' = { ...s, stagedColumns: s.stagedColumns.union(Set("memo")) },
  }

  /// One bounded batch representative. Empty strings are already filled.
  action stageBackfill(row: str): bool = all {
    ROWS.contains(row), s.owner != 0,
    s.stagedColumns.contains("memo"), s.stagedMemo.get(row) == "<NULL>",
    s' = { ...s, stagedMemo: s.stagedMemo.set(row, ORIGINAL.get(row)) },
  }

  action stageRetire: bool = all {
    s.owner != 0,
    s' = { ...s, stagedRetired: s.stagedRetired.union(Set("old_memo")) },
  }

  action commit: bool = all {
    s.owner != 0, s.generation < 3, s.acquiredAt == s.generation,
    s' = { ...s, columns: s.stagedColumns, memo: s.stagedMemo,
      retired: s.stagedRetired, owner: 0,
      generation: s.generation + 1, result: "committed" },
  }

  /// Failure, deadline, or process loss before commit has the same rollback.
  action abort: bool = all {
    s.owner != 0,
    s' = { ...s, owner: 0, stagedColumns: s.columns,
      stagedMemo: s.memo, stagedRetired: s.retired, result: "aborted" },
  }

  /// Acknowledged application values must not be overwritten by a later fill.
  action applicationWrite(row: str): bool = all {
    ROWS.contains(row), s.owner == 0, s.columns.contains("memo"),
    s' = { ...s, memo: s.memo.set(row, "edited"),
      acknowledged: s.acknowledged.set(row, "edited") },
  }

  /// Unsafe declarations and unreadable catalogs are refused before DDL.
  action refuseUnsafe: bool = all {
    s.owner == 0,
    s' = { ...s, result: "unsafe declaration or unavailable catalog" },
  }

  action step = {
    nondet who = Set(1, 2).oneOf()
    nondet row = ROWS.oneOf()
    any { acquire(who), refuseContender(who), stageAdd,
      stageBackfill(row), stageRetire, commit, abort,
      applicationWrite(row), refuseUnsafe }
  }

  /// Retirement never drops the server's historical column.
  val invOriginalColumnPresent = s.columns.contains("old_memo")
  /// Every original row remains in the backfill projection, without duplicates.
  val invRowsPreserved = s.memo.keys() == ROWS and s.stagedMemo.keys() == ROWS
  /// Already acknowledged values survive all future reconciliation attempts.
  val invAcknowledgedValues = ROWS.forall(row =>
    s.acknowledged.get(row) != "<NULL>" implies
      s.memo.get(row) == s.acknowledged.get(row))
  /// The only new values are a copy, an application write, or NULL.
  val invExactValues = ROWS.forall(row =>
    Set("<NULL>", "edited", ORIGINAL.get(row)).contains(s.memo.get(row)))
  /// Nothing can change the generation while a reconciler owns its snapshot.
  val invNoStaleCommit = s.owner != 0 implies s.acquiredAt == s.generation
  val invRetirementFrozen = s.retired.subseteq(Set("old_memo"))
  val invKnownOwner = Set(0, 1, 2).contains(s.owner)

  run commitPreservesExactValuesTest = init.then(acquire(1)).then(stageAdd)
    .then(stageBackfill("receipt_a")).then(stageBackfill("receipt_b"))
    .then(stageRetire).then(commit)
    .expect(s.memo == ORIGINAL and s.columns.contains("old_memo"))

  run crashDiscardsOnlyStagedWorkTest = init.then(acquire(1)).then(stageAdd)
    .then(stageBackfill("receipt_a")).then(abort).then(acquire(2))
    .expect(s.columns == Set("old_memo") and s.memo == BLANK)

  run acknowledgedWriteSurvivesNextFillTest = init.then(acquire(1)).then(stageAdd)
    .then(commit).then(applicationWrite("receipt_a")).then(acquire(2))
    .then(stageBackfill("receipt_b")).then(commit)
    .expect(s.memo.get("receipt_a") == "edited" and s.memo.get("receipt_b") == "")

  run contenderCannotPublishTest = init.then(acquire(1)).then(stageAdd)
    .then(refuseContender(2))
    .expect(s.owner == 1 and s.columns == Set("old_memo"))
}
