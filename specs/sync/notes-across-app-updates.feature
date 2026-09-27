@domain:sync
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
