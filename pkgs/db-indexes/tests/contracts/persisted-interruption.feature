Feature: Recover from every persisted-write boundary
  When a mixed reconciliation is interrupted, the database operator wants a fresh run to converge,
  so committed index work and committed retirement metadata are both recoverable.

  Rule: Recovery re-inspects durable state after any write prefix
    No counter-example: recovery requires faults to stop and sufficient budget.

    Scenario Outline: Interruption before any persisted write remains recoverable
      Given the indexing fixture is "mixed reconciliation"
      And a run was interrupted before write <position>
      When a fresh reconciler runs
      Then the mixed reconciliation has converged
      And every protected index is unchanged

      Examples:
        | position |
        | 1        |
        | 2        |
        | 3        |
        | 4        |
        | 5        |

    Scenario Outline: Interruption after any committed write remains recoverable
      Given the indexing fixture is "mixed reconciliation"
      And a run was interrupted after write <position>
      When a fresh reconciler runs
      Then the mixed reconciliation has converged
      And every protected index is unchanged

      Examples:
        | position |
        | 1        |
        | 2        |
        | 3        |
        | 4        |
        | 5        |
