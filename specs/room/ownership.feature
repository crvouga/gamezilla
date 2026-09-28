@domain:room
Feature: Owning the room
  When people share a room, its owner wants to keep out someone who spoils
  it, so only welcome people change the tally and the match.

  Background:
    Given Alice, Bob and Eve are in the room

  Rule: The first person to claim the room owns it

    Scenario: Claiming a room nobody owns makes the claimer its owner
      Given nobody owns the room
      When Alice claims the room
      Then everyone sees that Alice owns the room

    Scenario: Nobody can claim a room someone already owns
      Given Alice owns the room
      When Bob claims the room
      Then Bob is told the room already has an owner
      And everyone still sees that Alice owns the room

  Rule: Only the owner can turn someone away, and never themselves

    Scenario: The owner turns someone away
      Given Alice owns the room
      When Alice turns Eve away
      Then everyone sees that Eve is turned away

    Scenario: Someone who is not the owner cannot turn anyone away
      Given Alice owns the room
      When Bob turns Eve away
      Then Bob is told only the owner can turn someone away

    Scenario: The owner cannot turn themselves away
      Given Alice owns the room
      When Alice turns Alice away
      Then Alice is told the owner cannot turn themselves away
      And everyone still sees that Alice owns the room

  Rule: Someone who is turned away cannot change anything in the room

    Scenario: A change from someone who is turned away is refused
      Given Alice has turned Eve away
      When Eve adds one to the tally
      Then Eve is told they have been turned away
      And everyone still sees a tally of 0

    Scenario: Everyone else's changes still count
      Given Alice has turned Eve away
      When Bob adds one to the tally
      Then everyone sees a tally of 1
