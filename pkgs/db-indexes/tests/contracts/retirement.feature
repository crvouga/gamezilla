Feature: Retire only indexes that remain unused
  When a workload changes, the database operator wants obsolete indexes removed cautiously,
  so a temporary workload change cannot discard an index still in use.

  Rule: Retirement requires the complete configured window

    Scenario: A newly obsolete index remains while its window begins
      Given the indexing fixture is "new retirement"
      When the reconciler runs
      Then the owned index is present
      And the retirement window starts now

    Scenario Outline: The thirty-day window has an exact boundary
      Given the indexing fixture is "expired retirement"
      And the retirement age is <days> days
      When the reconciler runs
      Then the owned index is <presence>

      Examples:
        | days | presence |
        | 0    | present  |
        | 29   | present  |
        | 30   | absent   |
        | 31   | absent   |

  Rule: Observed use restarts retirement rather than permitting removal

    Scenario: New use at an expired window keeps the index
      Given the indexing fixture is "used retirement"
      When the reconciler runs
      Then the owned index is present
      And the retirement window starts now

    Scenario: A reset usage counter cannot authorize removal
      Given the indexing fixture is "reset usage"
      When the reconciler runs
      Then the owned index is present
      And no removal was attempted

    Scenario: Missing usage evidence cannot authorize removal from a nonzero baseline
      Given the indexing fixture is "missing usage"
      When the reconciler runs
      Then the owned index is present
      And no removal was attempted

  Rule: A desired index stops retiring

    Scenario: Reintroducing a lookup clears its retirement
      Given the indexing fixture is "desired retirement"
      When the reconciler runs
      Then the owned index is present
      And the owned index is not retiring

    Scenario: An obsolete index does not clear its retirement
      Given the indexing fixture is "expired retirement"
      And the retirement age is 29 days
      When the reconciler runs
      Then the owned index is present
      And the owned index is retiring
