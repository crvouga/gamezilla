@domain:sync-engine
Feature: Notes across app updates
  When the app updates, or goes back to an earlier version, a person wants
  every note it had still to be there, including notes not yet sent, and to
  stay in step with everyone.

  Rule: An update keeps every note, even an update that fetches every note again

    Scenario: A note written offline still reaches others after an update that fetches every note again
      Given Bob has written the note "Hotel" saying "Main St"
      And Alice's app is offline
      And Alice has written the note "Groceries" saying "milk"
      When Alice's app updates to a version that fetches every note again
      And Alice's app comes back online
      Then Alice sees the note "Groceries" saying "milk"
      And Alice sees the note "Hotel" saying "Main St"
      And Bob sees the note "Groceries" saying "milk"

  Rule: Going back to an earlier version keeps every note and stays connected

    Scenario Outline: After going back from a version that <adds>, the app still has its notes and stays connected
      Given Alice and Bob use the app
      And Alice's app has updated to a version that <adds>
      And Alice has written the note "Groceries" saying "milk"
      When Alice's app goes back to the earlier version
      Then Alice sees the note "Groceries" saying "milk"
      And Alice's app is still connected
      And Bob sees the note "Groceries" saying "milk"

      Examples:
        | adds                 |
        | gives notes a colour |
        | tags notes           |

  Rule: Going back to an earlier version keeps what the newer version gave notes

    Scenario Outline: Going back to the earlier version keeps the <detail> a newer version gave a note
      Given Alice's app has updated to a version that <adds>
      And Alice has written the note "Groceries" saying "milk"
      And Alice has given the note "Groceries" the <detail> <value>
      When Alice's app goes back to the earlier version
      And Alice's app updates to the version that <adds> once more
      Then Alice sees the note "Groceries" <shown>

      Examples:
        | detail | value      | adds                 | shown              |
        | colour | green      | gives notes a colour | coloured green     |
        | tag    | "shopping" | tags notes           | tagged "shopping"  |

  Rule: People on different versions keep in step, and nothing a newer version adds is lost
    Scenario: A colour the team gives a note reaches Alice once her app updates to the version with colours
      Given Alice's app is on a version without colours
      And Alice has written the note "Groceries" saying "milk"
      And the team has given the note "Groceries" the colour green
      When Alice's app updates to a version that gives notes a colour
      Then Alice sees the note "Groceries" coloured green
      And Alice's app is still connected

    Scenario: An edit from an earlier version keeps the colour a newer version gave the note
      Given Alice's app has updated to a version that gives notes a colour
      And Bob's app is still on the earlier version
      And Alice has written the note "Groceries" saying "milk"
      And Alice has given the note "Groceries" the colour green
      When Bob writes the note "Groceries" saying "eggs"
      Then Alice sees the note "Groceries" saying "eggs"
      And Alice sees the note "Groceries" coloured green
