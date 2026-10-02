@domain:db-indexes
Feature: Resume interrupted index reconciliation
  When maintenance is interrupted, the database operator wants a fresh run to finish safely,
  so partial work never requires guessing which operations committed.

  Rule: An interrupted action stops its run and remains unfinished

    Scenario Outline: A crash is reported at each build outcome — <fixture>
      Given the indexing fixture is "<fixture>"
      When the reconciler runs
      Then the run reports unfinished work
      And the run does not report the interrupted action as completed

      Examples:
        | fixture            |
        | crash before build |
        | crash after build  |
        | crash invalid build |

    Scenario Outline: A fresh run converges from every interrupted build outcome — <fixture>
      Given the indexing fixture is "<fixture>"
      And an interrupted run has occurred
      When a fresh reconciler runs
      Then exactly one valid desired index exists
      And every protected index is unchanged

      Examples:
        | fixture             |
        | crash before build  |
        | crash after build   |
        | crash invalid build |

  Rule: Deferral and failure remain visible instead of claiming completion

    Scenario: Lock contention defers a build
      Given the indexing fixture is "lock contention"
      When the reconciler runs
      Then the run reports a deferred action with its reason
      And the owned index is absent

    Scenario: A rejected build reports its failure
      Given the indexing fixture is "failed build"
      When the reconciler runs
      Then the run reports a failed action with its reason
      And the owned index is absent

    Scenario: A successful build reports completion
      Given the indexing fixture is "new build"
      When the reconciler runs
      Then exactly one valid desired index exists
      And the run reports one completed action

  Rule: Reconciliation is idempotent after convergence
    No counter-example: a changed workload is a new reconciliation, not repetition.

    Scenario: Repeating a successful build performs no further writes
      Given the indexing fixture is "new build"
      And a successful run has occurred
      When a fresh reconciler runs
      Then exactly one valid desired index exists
      And no write was attempted
