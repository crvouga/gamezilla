Feature: Admit useful index candidates within configured limits
  When the workload is analyzed, the database operator wants justified bounded candidates,
  so small workloads and low-value candidates do not consume maintenance capacity.

  Rule: Online candidates meet the configured row threshold

    Scenario Outline: Admission has an exact ten-thousand-row boundary
      Given the indexing fixture is "<fixture>"
      When the reconciler plans
      Then the plan has <count> desired indexes
      And no write was attempted

      Examples:
        | fixture             | count |
        | below row threshold | 0     |
        | at row threshold    | 1     |
        | above row threshold | 1     |

  Rule: Online candidates meet the configured improvement threshold

    Scenario Outline: Admission has an exact threefold-improvement boundary
      Given the indexing fixture is "<fixture>"
      When the reconciler plans
      Then the plan has <count> desired indexes
      And no write was attempted

      Examples:
        | fixture           | count |
        | below improvement | 0     |
        | at improvement    | 1     |
        | above improvement | 1     |

  Rule: Duplicate statements do not multiply indexes
    No counter-example: distinct access paths are not duplicates.

    Scenario: Two declarations of one lookup require one index
      Given the indexing fixture is "duplicate lookup"
      When the reconciler plans
      Then the plan has 1 desired indexes
      And no write was attempted

  Rule: A table cannot exceed the configured candidate budget

    Scenario: One candidate is admitted while another is excluded
      Given the indexing fixture is "per table cap"
      When the reconciler plans
      Then the plan has 1 desired indexes
      And the plan explains the exclusion as "over_budget"

    Scenario: A workload within the cap needs no budget exclusion
      Given the indexing fixture is "new build"
      When the reconciler plans
      Then the plan has 1 desired indexes
      And the plan has no exclusions

  Rule: Migration indexing admits required paths on an empty table

    Scenario: An empty table still receives its migration index
      Given the indexing fixture is "migration on empty table"
      When the reconciler runs
      Then exactly one valid desired index exists

    Scenario: Online indexing excludes a table below its threshold
      Given the indexing fixture is "below row threshold"
      When the reconciler plans
      Then the plan explains the exclusion as "below_min_rows"

  Rule: No additional index is needed for an empty workload or a primary-key lookup
    No counter-example: additional non-primary access paths belong to the admission rules.

    Scenario Outline: Workloads without additional access paths produce no candidates
      Given the indexing fixture is "<fixture>"
      When the reconciler plans
      Then the plan has 0 desired indexes
      And no write was attempted

      Examples:
        | fixture         |
        | empty workload  |
        | primary lookup  |
