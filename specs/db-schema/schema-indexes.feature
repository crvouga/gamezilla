@domain:db-schema
Feature: Reconcile declared indexes while keeping the database usable
  When a declaration adds an index, the application owner wants index creation
  to preserve data access, so a deployment does not block ordinary work indefinitely.

  Rule: Server index creation is a separate phase outside the schema transaction

    Scenario: Building an ordinary server index permits concurrent application writes
      Given the declared schema transaction has committed and a required non-unique index is missing
      When the server index phase runs
      Then the index is built concurrently outside that schema transaction
      And acknowledged application writes during the build remain readable

    Scenario: An index-only pass never repeats table changes or backfills
      Given the schema transaction committed its table changes and backfills
      When the server index-only phase runs
      Then only index operations are executed
      And all rows and filled values remain unchanged

    Scenario: A transactional index build is refused rather than silently downgraded
      Given the server index phase is invoked inside an existing transaction
      When a concurrent index build is required
      Then the build is refused with the reason concurrent build requires a separate phase
      And it does not fall back to a blocking index build

  Rule: A failed index build never masquerades as usable coverage

    Scenario: An interrupted build is repaired before success is reported
      Given a required server index exists as an invalid leftover from a failed build
      When the server index phase runs
      Then the invalid owned leftover is repaired and the resulting index is valid
      And reconciliation reports success only after validating the required index definition

    Scenario: Duplicate legacy values refuse a new uniqueness constraint without deleting data
      Given two ledger rows share the same value for a proposed unique index
      When the declared unique index is reconciled
      Then reconciliation reports failure with the reason duplicate values
      And both original rows and all previously valid constraints remain unchanged

    Scenario: An existing name with a different definition cannot count as success
      Given a required index name is occupied by a different index definition
      When the declared index is reconciled
      Then reconciliation is refused with the reason index definition mismatch
      And the conflicting index and every row remain unchanged

  Rule: Finite resource budgets bound disruptive work

    Scenario: A lock timeout leaves a safe resumable result
      Given an index operation cannot acquire its lock within the configured budget
      When the server index phase runs
      Then reconciliation reports incomplete work with the reason lock budget exhausted
      And valid existing indexes and all saved rows remain intact

    Scenario: An exhausted resource budget cannot be reported as full convergence
      Given completing a required index would exceed the configured work budget
      When the server index phase runs
      Then reconciliation reports incomplete work with the reason work budget exhausted
      And a fresh pass can finish without losing saved rows
