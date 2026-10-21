# Client recovery contract examples

These examples describe desired framework safety. They are documentation,
not executed adapter checks. See [SAFETY_CONTRACT.md](SAFETY_CONTRACT.md) for coverage and gaps.

```gherkin
@domain:db-schema
Feature: Recover local schema reconciliation without erasing saved work
  When an application reconciles its local schema, the application owner wants
  every saved row and queued write retained, so an update cannot discard unsent work.

  Rule: A shared database preserves data outside the current declaration

    Scenario: An older declaration preserves a newer column verbatim
      Given the local ledger contains an undeclared column memo with "paid", "", and NULL values
      When the older declaration is reconciled with declared-only ownership
      Then memo and all its values remain unchanged
      And the current declaration is usable

    Scenario: Package reconciliation leaves other packages' tables intact
      Given the shared database includes a populated ledger and a populated upload queue
      When the ledger declaration is reconciled with declared-only ownership
      Then every queued write and every undeclared table remains unchanged

    Scenario: Default reconciliation cannot invoke whole-database deletion
      Given the shared database includes an undeclared populated table
      When the ledger declaration is reconciled without an ownership override
      Then the undeclared table and all its rows remain unchanged

    Scenario: Incompatible declared drift refuses before rebuilding
      Given the declared amount column has an incompatible stored type
      When the local schema is reconciled
      Then reconciliation is refused with the reason incompatible type
      And the catalog, rows, and queued writes remain unchanged

  Rule: Retiring a local column preserves every row and every remaining value

    Scenario: A row-preserving rebuild removes only the retired column
      Given the populated ledger has a permanently retired memo column
      When the local schema is reconciled
      Then only the retired memo column is removed
      And all row identifiers, remaining values, tombstones, and queued writes remain unchanged

    Scenario: Copy aliases preserve the original value before retirement
      Given memo is a new column renamed from retired old_memo containing "café", "", and NULL
      When the local schema is reconciled
      Then each memo value equals its original old_memo value
      And all ledger row identifiers are unchanged

    Scenario: A failed copy leaves the original table authoritative
      Given copying a populated ledger into its replacement will fail
      When the local schema is reconciled
      Then reconciliation reports failure with the copy reason
      And every original ledger row remains recoverable without using the partial replacement

    Scenario: Equal row counts cannot hide a changed value or identifier
      Given a replacement ledger has the original row count but a changed identifier or value
      When the replacement is validated for publication
      Then publication is refused with the reason replacement differs from acknowledged data
      And the original ledger remains authoritative

    Scenario: Retirement cannot erase the last durable copy of unsent work
      Given a retired local memo value has not reached the server or a durable queued write
      When the local schema is reconciled
      Then retirement is refused with the reason unsent value has no durable replacement
      And the original memo value remains available

  Rule: Interrupted rebuilds recover from an unambiguous authoritative copy

    Scenario Outline: A fresh reconciliation recovers <boundary>
      Given a ledger rebuild was interrupted <boundary>
      When the local schema is reconciled by a fresh instance
      Then every acknowledged row and value is preserved exactly once
      And the declared table is usable with no required recovery copy discarded prematurely

      Examples:
        | boundary                                 |
        | before the original table is staged      |
        | after the original table is staged       |
        | after the replacement table is created   |
        | during the copy into the replacement     |
        | after the complete copy is validated     |
        | after publishing the complete replacement |

    Scenario: Ambiguous recovery refuses to guess which values to discard
      Given both recovery copies contain acknowledged rows that differ
      When the local schema is reconciled
      Then reconciliation is refused with the reason ambiguous recovery state
      And both copies remain available without deleting or overwriting either

    Scenario: A second interruption during recovery remains recoverable
      Given recovery itself was interrupted after publishing a complete replacement
      When the local schema is reconciled by another fresh instance
      Then every acknowledged row and value is preserved exactly once
      And reconciling again has an empty change plan

  Rule: Rebuilds preserve database relationships and connection settings

    Scenario: Another table keeps referencing the declared table
      Given invoices reference populated ledger rows before a ledger rebuild
      When the local schema is reconciled
      Then invoice references still target the ledger and resolve to the same rows
      And no reference points at a staging table

    Scenario Outline: Connection settings are restored when reconciliation will <outcome>
      Given foreign-key enforcement and legacy rename handling have known initial settings
      And reconciliation will <outcome>
      When the local schema is reconciled
      Then both connection settings equal their initial settings

      Examples:
        | outcome                            |
        | complete successfully              |
        | fail while creating a replacement  |
        | fail while copying rows            |
        | fail while publishing a replacement |

    Scenario: A pending application write cannot race the copy and be lost
      Given an application write overlaps a row-preserving ledger rebuild
      When the local schema is reconciled
      Then each acknowledged write is retained in the published ledger or its durable upload queue
      And an uncommitted write receives a failure rather than a false acknowledgement

    Scenario: An unsupported attached object is preserved or stops the rebuild
      Given a ledger rebuild would invalidate an attached trigger or constraint that cannot be preserved
      When the local schema is reconciled
      Then reconciliation is refused with the reason unsupported attached object
      And the original table, attached object, and saved rows remain unchanged
```
