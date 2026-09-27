@domain:friends @goal:social:3
Feature: People search
  Typing a username finds that person and settles: no eternal "Searching…".

  Background:
    Given Alice and Bob are signed in

  Scenario: Searching a username finds that person, both ways round
    When Alice searches for "bob"
    Then Alice's search shows Bob
    When Bob searches for "alice"
    Then Bob's search shows Alice

  Scenario: The start of a name finds them, in any letter case
    When Alice searches for "BO"
    Then Alice's search shows Bob

  Scenario: You are not in your own results
    When Alice searches for "ali"
    Then Alice's search shows nobody

  Scenario: Nobody by that name means search says so instead of spinning
    When Alice searches for "zz_nobody"
    Then Alice's search shows nobody
