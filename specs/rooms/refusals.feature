@domain:rooms
Feature: Refused changes
  A room refuses a change it does not understand and a change from someone it
  turns away. The sender learns their change was refused, and nothing changes
  for anyone, so a bad or unwelcome change can never spoil what everyone
  shares.

  Rule: A change the room does not understand is refused as invalid

    Scenario: A change the room does not understand is refused and changes nothing
      Given Alice is in a shared counter room
      When Alice makes a change the room does not understand
      Then Alice's change is refused as invalid
      And Alice has no changes waiting to be sent
      And everyone agrees on a count of 0

  Rule: A person the room turns away cannot change it

    Scenario: A person the room turns away cannot even claim an unclaimed room
      Given Alice and Eve are in an ownership room that turns Eve away
      And nobody has claimed the room
      When Eve claims the room
      Then Eve's change is refused as not allowed
      And the room has accepted 0 changes

  Rule: Turning one person away does not stop anyone else

    Scenario: Others' changes still count in a room that turns someone away
      Given Alice and Eve are in an ownership room that turns Eve away
      And nobody has claimed the room
      When Alice claims the room
      Then the room has accepted 1 change
