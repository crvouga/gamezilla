@domain:db-indexes
Feature: Preserve indexes outside automatic ownership
  When indexes are tuned, the database operator wants existing protections preserved,
  so tuning cannot remove a primary key, uniqueness rule, or an operator's index.

  Rule: Only ordinary owned indexes may be changed

    Scenario: An ordinary owned index can retire
      Given the indexing fixture is "expired retirement"
      When the reconciler runs
      Then the owned index is absent

    Scenario Outline: Protected indexes survive even with an owned-looking name — <fixture>
      Given the indexing fixture is "<fixture>"
      When the reconciler runs
      Then every protected index is unchanged
      And no action targets a protected index

      Examples:
        | fixture             |
        | operator indexes    |
        | primary impostor    |
        | unique impostor     |
        | invalid unique      |
        | desired unique name |

  Rule: Planning cannot change indexes or retirement metadata
    No counter-example: analysis never authorizes a write.

    Scenario: A removal plan preserves the database snapshot
      Given the indexing fixture is "expired retirement"
      When the reconciler plans
      Then the database snapshot is unchanged
      And no write was attempted
