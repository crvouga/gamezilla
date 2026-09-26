@domain:friends @goal:social:3
Feature: Profile changes reach other people
  A profile is what other people see of you: rename yourself and your friends'
  lists show the new name, and search finds you by it, not by the name you gave up.

  Scenario: Bob renames and Alice's friends list and search follow
    Given Alice and Bob are friends
    And Alice is viewing their friends list with Bob in it
    When Bob renames themselves to @robert_1
    Then Alice watches @robert_1 appear in their friends list within 15 seconds
    And @bob is gone from Alice's open friends list
    When Alice searches for "robert_1"
    Then Alice's search shows @robert_1
    When Alice searches for "bob"
    Then Alice's search shows nobody
