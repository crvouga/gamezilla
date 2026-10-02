Feature: Bound maintenance work and preserve unfinished work
  When indexing runs during service, the database operator wants bounded maintenance,
  so index work can yield and later resume without losing its obligations.

  Rule: A run does not start an action beyond its estimated deadline

    Scenario: A build fitting the deadline starts
      Given the indexing fixture is "new build"
      And the run budget is 10 milliseconds
      When the reconciler runs
      Then exactly one valid desired index exists

    Scenario: A build exceeding the deadline remains unfinished
      Given the indexing fixture is "new build"
      And the run budget is 9 milliseconds
      When the reconciler runs
      Then the run reports unfinished work
      And no write was attempted

  Rule: A run respects its successful-build limit

    Scenario: One run builds only its allowed first index
      Given the indexing fixture is "two builds"
      When the reconciler runs
      Then the run reports one completed action
      And the run reports unfinished work

    Scenario: The next run finishes the remaining build
      Given the indexing fixture is "two builds"
      And a successful run has occurred
      When a fresh reconciler runs
      Then both desired indexes are valid
      And the run has no unfinished work
