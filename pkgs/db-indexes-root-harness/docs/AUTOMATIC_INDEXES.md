# Automatic indexes contract examples

These examples describe desired framework safety. They are documentation,
not executed adapter checks. See [SAFETY_CONTRACT.md](../../db-schema/docs/SAFETY_CONTRACT.md) for coverage and gaps.

```gherkin
@domain:db-indexes
Feature: Reconcile workload indexes without harming data or existing access paths
  When the declared workload changes, the application owner wants only safe
  index changes, so automatic tuning cannot erase data or remove protected indexes.

  Rule: Ownership requires an exact ordinary-index identity

    Scenario: Missing workload coverage creates only its deterministic owned index
      Given a declared lookup needs an ordinary index absent from the catalog
      When automatic indexes are reconciled
      Then its deterministic autoidx index is created and validated
      And the domain rows and existing protected indexes remain unchanged

    Scenario Outline: Automatic indexing preserves <object>
      Given an unwanted catalog object is <object>
      When automatic indexes are reconciled after the retirement window
      Then the object and its definition remain unchanged
      And no DDL targets that object

      Examples:
        | object                                  |
        | an ordinary manually managed index      |
        | a declared ix index                     |
        | a declared ux index                     |
        | a primary-key index                     |
        | a unique index with an autoidx name      |
        | an exclusion index with an autoidx name  |

    Scenario: An owned-looking index on the wrong table cannot be adopted
      Given an autoidx name collides with an index on another table
      When automatic indexes are reconciled
      Then reconciliation refuses that object with the reason ownership identity mismatch
      And the conflicting object remains unchanged

    Scenario: An incomplete workload cannot authorize retirement
      Given one declared workload statement cannot be analyzed safely
      When automatic indexes are reconciled
      Then retirement is refused with the reason workload coverage unproven
      And every previously valid index remains unchanged

  Rule: Replacement coverage becomes usable before old coverage is retired

    Scenario: A replacement build completes before the old index can disappear
      Given the workload needs a replacement for an existing valid owned index
      When automatic indexes are reconciled
      Then the replacement is valid before retirement of the old coverage can complete
      And domain rows remain unchanged

    Scenario: A failed replacement cannot remove the last usable access path
      Given building the required replacement index will fail
      When automatic indexes are reconciled
      Then reconciliation reports incomplete work with the build reason
      And the old valid index remains usable and no retirement drop is executed

  Rule: Retirement requires both a complete quiet window and trustworthy usage

    Scenario Outline: A quiet unwanted index is <result> after <age>
      Given an owned unwanted index has trustworthy unchanged usage since retirement began
      And its retirement window is 30 days with <age> elapsed
      When automatic indexes are reconciled
      Then the unwanted index is <result>

      Examples:
        | age                     | result |
        | 29 days                 | kept   |
        | 30 days less one tick   | kept   |
        | exactly 30 days         | removed |
        | 31 days                 | removed |

    Scenario: Usage during retirement restarts the full quiet window
      Given a retiring index was used after retirement began
      When automatic indexes are reconciled
      Then the index is kept and its quiet window starts again from the observed usage

    Scenario: Renewed workload demand cancels retirement
      Given a retiring index is needed by the current declared workload
      When automatic indexes are reconciled
      Then the index is kept and its retirement metadata is cleared

    Scenario: A supported older deployment keeps its declared access path
      Given an older supported deployment still requires an owned index absent from the newest workload
      When automatic indexes are reconciled
      Then the index is kept with the reason supported workload still requires it
      And its retirement does not begin

    Scenario Outline: Retirement keeps indexes when evidence is <untrustworthy evidence>
      Given retirement eligibility depends on <untrustworthy evidence>
      When automatic indexes are reconciled
      Then the index is kept with the reason retirement eligibility unproven
      And no drop executes

      Examples:
        | untrustworthy evidence                |
        | an unavailable usage read             |
        | a reset usage counter                 |
        | malformed retirement metadata         |
        | a clock earlier than retirement began |
        | usage that changed after planning     |
        | workload demand renewed after planning |

  Rule: Interruption and deadlines preserve a resumable truthful result

    Scenario Outline: A fresh run converges when interrupted <boundary>
      Given automatic reconciliation was interrupted <boundary>
      When a fresh instance reconciles the unchanged workload
      Then it converges to valid desired indexes without modifying protected objects or domain rows
      And repeating reconciliation has no additional effect

      Examples:
        | boundary                                  |
        | before creating a required index          |
        | after creating it but before metadata     |
        | after persisting retirement metadata      |
        | after an invalid concurrent-build artifact |
        | after dropping an eligible retiring index |

    Scenario: An exhausted deadline starts no further index action
      Given the injected clock has reached the reconciliation deadline
      When automatic indexes are reconciled
      Then no further index action starts and the report identifies unfinished work
      And a fresh run can resume it without changing domain rows

    Scenario: Required deployment indexes cannot be silently skipped
      Given a required deployment index cannot be built within the configured limits
      When automatic indexes are reconciled with the deployment configuration
      Then deployment reconciliation reports failure with the reason required coverage unavailable
      And no incomplete result is described as successful convergence

    Scenario: Two reconcilers cannot use stale evidence to drop a required index
      Given two reconcilers planned retirement before another deployment renewed the workload
      When either reconciler attempts the retirement drop
      Then the drop is refused with the reason stale retirement evidence
      And the currently required index remains usable
```
