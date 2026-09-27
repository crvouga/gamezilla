@domain:spaces @goal:spaces:2
Feature: What a space's link leads to
  A link is how most people arrive, so it always says where it leads: into a
  live space, or clearly to a space that has ended or does not exist, never to
  a blank or endless wait.

  Scenario: The link to an ended space says it has ended
    Given Alice and Bob are guests
    And Alice has hosted a space and ended it
    When Bob joins the space from the link
    Then Bob sees the space has ended within 15 seconds
    And Bob is not offered to join

  Scenario: A link to a space that never existed says so
    Given Bob is a guest
    When Bob opens a link to a space that does not exist
    Then Bob is told the space cannot be found within 15 seconds
    And Bob can go back to Spaces

  Scenario: Someone who stepped out returns to the space once
    Given Alice and Bob are friends
    And Alice is hosting a space that Bob joined from the lobby
    And Bob has gone back to the lobby
    When Bob joins Alice's space from the lobby
    Then Bob is in the space
    And Alice sees 2 people in the space within 20 seconds
