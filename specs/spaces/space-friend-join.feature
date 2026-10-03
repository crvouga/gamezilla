@domain:spaces
Feature: A friend joins from the lobby
  When a friend is hosting an open space, a person wants to find it in their
  lobby and join it, so they do not need its space link.

  Background:
    Given Alice and Bob are friends

  Rule: A friend's lobby lists their open space, and a person can join it from there

    Scenario: A friend's lobby lists a space as soon as it is created
      When Alice creates a space
      Then Bob's lobby lists Alice's space

    Scenario: A friend joins an open space from the lobby
      Given Alice is hosting a space
      When Bob joins Alice's space from the lobby
      Then Bob is in the space

    @regression:space-lobby-ended-refusal
    Scenario: A friend is not offered a space that has ended
      Given Alice has hosted a space and ended it
      When Bob joins Alice's space from the lobby
      Then Bob is not offered to join
