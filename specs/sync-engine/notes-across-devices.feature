@domain:sync-engine
Feature: Notes across devices
  When a person writes on whichever device is at hand, they want their notes
  on every device they use, so writing offline remains available when their
  devices are back online.

  Rule: A person's devices all show their notes once they have a connection
    No counter-example: reconnecting does not remove the person's existing notes.

    Scenario: Notes written on two devices show on both
      Given Alice uses the app on a phone and a tablet
      And Alice's tablet is offline
      And Alice has written the note "Groceries" on their phone
      And Alice has written the note "Chores" on their tablet
      When Alice's tablet comes back online
      Then Alice's phone shows the notes "Groceries" and "Chores"
      And Alice's tablet shows the notes "Groceries" and "Chores"
