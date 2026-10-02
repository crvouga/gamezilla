@domain:db-schema
Feature: Reconcile a declared server schema without losing saved data
  When a schema declaration changes, the application owner wants reconciliation
  to preserve saved data and older applications, so a deployment cannot erase history.

  Rule: Validate the entire declaration and catalog before executing any change

    Scenario: Additive changes preserve every existing row
      Given the populated ledger has a valid declaration adding the nullable column memo
      When the server schema is reconciled
      Then memo exists and every previous row and value is unchanged
      And reconciling the same declaration again has an empty change plan

    Scenario Outline: Unsafe drift <drift> refuses the entire plan
      Given the declaration adds memo but the catalog also has <drift>
      When the server schema is reconciled
      Then reconciliation is refused with the reason <reason>
      And no schema change or data write has executed

      Examples:
        | drift                            | reason                    |
        | an unretired extra column         | undeclared column         |
        | a changed declared column type    | incompatible type         |
        | a missing retired column          | missing retirement target |
        | a changed retired column type     | changed frozen type       |
        | a missing retired table           | missing retirement target |
        | an unavailable catalog read       | catalog unavailable       |

  Rule: Evolution preserves the contract of every earlier declaration

    Scenario: Retirement preserves server values for an older application
      Given memo contains the values "paid", "", and NULL in three distinct ledger rows
      And memo is retired with its original frozen type
      When the server schema is reconciled
      Then an older declaration still reads those exact rows and memo values

    Scenario Outline: A declaration that would <change> is refused
      Given a proposed declaration would <change>
      When the declaration is checked against the earlier snapshot
      Then the declaration is refused with the reason <reason>
      And the earlier snapshot remains unchanged

      Examples:
        | change                              | reason                    |
        | remove a table without retirement   | table removed             |
        | remove a column without retirement  | column removed            |
        | rename a column in place            | column removed            |
        | change a logical type in place      | column type changed       |
        | remove a permanent retirement entry | retirement entry removed  |
        | alter a frozen retired type         | retired type changed      |

  Rule: Backfill fills blanks without rewriting acknowledged values

    Scenario: Copying into a new column leaves both history and filled values intact
      Given the ledger contains old_memo and a new memo column with blank and already filled values
      When memo is backfilled from old_memo in configured bounded batches
      Then only NULL memo values receive their source value
      And every old_memo value and every already filled memo value is unchanged

    Scenario: A failed batch is resumable without overwriting intervening writes
      Given one backfill batch is committed and a later batch failed
      And an application has filled a remaining memo with "edited after failure"
      When the same backfill is resumed
      Then all remaining eligible blanks are filled without changing "edited after failure"
      And the committed batch has no duplicate effect

    Scenario: A failing schema transaction publishes none of its partial changes
      Given adding memo and backfilling it share a schema transaction whose backfill will fail
      When the server schema is reconciled
      Then reconciliation reports failure with the database reason
      And the transaction leaves the original catalog and rows unchanged

  Rule: Only explicitly lossless physical repairs are permitted

    Scenario Outline: A lossless repair preserves boundary values for <repairable drift>
      Given the declared ledger has <repairable drift> and values at its physical boundaries
      When the server schema is reconciled
      Then <repair> is applied without changing row identifiers or values

      Examples:
        | repairable drift                         | repair                       |
        | an integer stored as int2                | widening to bigint           |
        | an integer stored as int4                | widening to bigint           |
        | an unexpected non-primary NOT NULL       | removing that NOT NULL       |
        | an engine default on a managed id column | removing that engine default |

    Scenario: A narrowing conversion cannot be treated as a repair
      Given a declared type change would narrow a stored integer
      When the server schema is reconciled
      Then reconciliation is refused with the reason incompatible type
      And every original value remains readable

  Rule: Concurrent deployment cannot execute a stale schema plan

    Scenario: A second reconciler observes the first reconciler's committed result
      Given two deployments reconcile the same declaration against the same populated database
      When their schema transactions overlap
      Then only one transaction changes the catalog at a time
      And both successful deployments observe the same preserved rows and declared shape

    Scenario: Exhausting the configured lock budget aborts safely
      Given another schema transaction holds the reconciliation lock beyond the configured budget
      When the server schema is reconciled
      Then reconciliation is refused with the reason lock budget exhausted
      And it releases its resources without changing the catalog or rows

    Scenario: A required repair that cannot meet the availability budget is deferred
      Given a lossless physical repair requires a blocking table lock beyond the configured budget
      When the server schema is reconciled
      Then reconciliation is refused with the reason availability budget exhausted
      And the original schema remains usable without starting an unbounded repair
