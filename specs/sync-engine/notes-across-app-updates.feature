@domain:sync-engine
Feature: Notes across app updates
  When the app changes to another version, a person wants to keep every note,
  so changing versions never costs their writing or stops sharing it.

  Rule: An update keeps every note, even an update that fetches every note again
    No counter-example: an app update never removes a person's writing.

    Scenario: A note written offline still reaches others after an update that fetches every note again
      Given Bob has written the note "Hotel" saying "Main St"
      And Alice's app is offline
      And Alice has written the note "Groceries" saying "milk"
      And Alice's app has updated to a version that fetches every note again
      When Alice's app comes back online
      Then Alice sees the note "Groceries" saying "milk"
      And Alice sees the note "Hotel" saying "Main St"
      And Bob sees the note "Groceries" saying "milk"

  Rule: Going back to an earlier version keeps every note and continues sharing it
    No counter-example: returning to an earlier app never removes or stops sharing a person's writing.

    Scenario Outline: After going back from a version that <adds>, Alice keeps and shares her notes
      Given Alice and Bob use the app
      And Alice's app has updated to a version that <adds>
      And Alice has written the note "Groceries" saying "milk"
      When Alice's app goes back to the earlier version
      Then Alice sees the note "Groceries" saying "milk"
      And Bob sees the note "Groceries" saying "milk"

      Examples:
        | adds                 |
        | gives notes a colour |
        | tags notes           |

  Rule: Going back to an earlier version keeps what the newer version gave notes
    No counter-example: a note never loses its colour or tags when the person changes their app.

    Scenario Outline: Going back to the earlier version keeps the <detail> a newer version gave a note
      Given Alice's app has updated to a version that <adds>
      And Alice has written the note "Groceries" saying "milk"
      And Alice has given the note "Groceries" the <detail> <value>
      And Alice's app has gone back to the earlier version
      When Alice's app updates to the version that <adds> once more
      Then Alice sees the note "Groceries" <shown>

      Examples:
        | detail | value      | adds                 | shown              |
        | colour | green      | gives notes a colour | coloured green     |
        | tag    | "shopping" | tags notes           | tagged "shopping"  |

  Rule: People on different versions keep in step, and nothing a newer version adds is lost
    No counter-example: sharing a note never removes its colour or tags.
    Scenario: A colour the team gives a note reaches Alice once her app updates to the version with colours
      Given Alice's app is on a version without colours
      And Alice has written the note "Groceries" saying "milk"
      And the team has given the note "Groceries" the colour green
      When Alice's app updates to a version that gives notes a colour
      Then Alice sees the note "Groceries" coloured green

    Scenario: An edit from an earlier version keeps the colour a newer version gave the note
      Given Alice's app has updated to a version that gives notes a colour
      And Bob's app is still on the earlier version
      And Alice has written the note "Groceries" saying "milk"
      And Alice has given the note "Groceries" the colour green
      When Bob writes the note "Groceries" saying "eggs"
      Then Alice sees the note "Groceries" saying "eggs"
      And Alice sees the note "Groceries" coloured green
