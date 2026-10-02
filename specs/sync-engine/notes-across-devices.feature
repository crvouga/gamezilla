@domain:sync-engine
Feature: Notes across devices
  When a person writes notes on whichever device is at hand, even one that is
  offline, they want every device they use to have all of their notes once
  the devices are back online.

  Rule: A person's devices all show their notes once they have a connection

    Scenario: Notes written on two devices show on both
      Given Alice uses the app on a phone and a tablet
      And Alice's tablet is offline
      And Alice has written the note "Groceries" on their phone
      When Alice writes the note "Chores" on their tablet
      And Alice's tablet comes back online
      Then Alice's phone shows the notes "Groceries" and "Chores"
      And Alice's tablet shows the notes "Groceries" and "Chores"
