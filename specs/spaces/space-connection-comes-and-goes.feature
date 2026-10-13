@domain:spaces
Feature: A missing connection is shown, and coming back returns the same person
  When a connection is lost and comes back, people want to be told it is
  missing and then return once, so a bad connection never looks like leaving
  or like being idle.

  Rule: While the connection is missing the person is told, and they are not idle

    Scenario: A host with no other device is told the connection is missing and is not idle
      Given Alice is hosting a space that Bob joined from the link
      When Alice loses the connection
      Then Alice is told the connection is missing within 15 seconds
      And Alice is not idle
      And Alice is in the space

    Scenario: An offline host still sees only herself, and she is not idle
      Given Alice is hosting a space that Bob joined from the link
      And Alice is offline
      When Alice views the space's presence
      Then Alice sees 1 person in the space's presence
      And Alice is not idle

  Rule: Coming back returns the same person once
    No counter-example: an ended space stays ended on return, already covered when a space ended by its offline host stays ended.

    Scenario: The same person returns once when the connection comes back
      Given Alice is hosting a space that Bob joined from the link
      And Alice has lost the connection
      When the connection comes back
      Then Bob sees 2 people in the space within 20 seconds
      And Alice is not idle

    Scenario: Losing the connection again still shows one Alice
      Given Alice is hosting a space that Bob joined from the link
      And Alice has lost the connection and the connection has come back
      When Alice loses the connection
      Then Alice sees 1 person in the space within 20 seconds
      And Alice is not idle

  Rule: A guest whose connection is lost is not shown as having left

    Scenario: Bob is told the connection is missing and is not shown as having left
      Given Alice is hosting a space that Bob joined from the link
      When Bob loses the connection
      Then Bob is told the connection is missing within 15 seconds
      And Bob does not see they have left the space
      And Alice sees 1 person in the space within 20 seconds

    Scenario: Bob is back once when his connection comes back
      Given Alice is hosting a space that Bob joined from the link
      And Bob has lost the connection
      When the connection comes back
      Then Alice sees 2 people in the space within 20 seconds
      And Alice sees Bob once in the space's presence
