@domain:sync-engine
Feature: Earlier saves preserve later edits
  When people change the same note while an earlier save is still awaiting
  confirmation, they want the later edit to remain, so nobody loses writing
  or gets a deleted note back just because the earlier save is confirmed.

  Background:
    Given Alice and Bob are in the shared space "Trip"

  Rule: Hearing back about an earlier save preserves the note's later state
    No counter-example: confirmation of an earlier save never changes a later edit.

    Scenario: An earlier save's confirmation preserves another person's writing
      Given Alice is waiting to hear back about the note "Groceries" saying "milk"
      And Bob has written the note "Groceries" saying "eggs"
      When Alice's app hears back about its last save
      Then Alice sees the note "Groceries" saying "eggs"
      And Bob sees the note "Groceries" saying "eggs"

    Scenario: An earlier save's confirmation preserves another person's deletion
      Given Alice is waiting to hear back about the note "Groceries" saying "milk"
      And Bob has written the note "Groceries" saying "eggs"
      And Bob has deleted the note "Groceries"
      When Alice's app hears back about its last save
      Then Alice does not see the note "Groceries"
      And Bob does not see the note "Groceries"

    Scenario: The earlier writer hears back while both writers await word
      Given Alice is waiting to hear back about the note "Groceries" saying "milk"
      And Bob is waiting to hear back about the note "Groceries" saying "eggs"
      When Alice's app hears back about its last save
      Then Alice sees the note "Groceries" saying "eggs"
      And Bob sees the note "Groceries" saying "eggs"

  Rule: Signing back in preserves shared writing and forgets unsent writing from the ended sign-in
    No counter-example: ending a sign-in must not send unsent writing on the person's next sign-in.

    Scenario: Signing back in keeps another person's later writing
      Given Alice is waiting to hear back about the note "Groceries" saying "milk"
      And Bob has written the note "Groceries" saying "eggs"
      And Alice's app has been signed out elsewhere
      When Alice's app signs back in
      Then Alice sees the note "Groceries" saying "eggs"
      And Bob sees the note "Groceries" saying "eggs"

    Scenario: Signing back in forgets writing that never reached anyone else
      Given Alice's app is offline
      And Alice has written the note "Groceries" saying "milk"
      And Alice's app has been signed out elsewhere
      When Alice's app signs back in
      Then Alice does not see the note "Groceries"
      And Bob does not see the note "Groceries"
