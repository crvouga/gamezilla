@domain:friends @goal:social:3
Feature: People search
  Typing a username finds that person and settles: no eternal "Searching…".

  Background:
    Given Alice and Bob are signed in

  Scenario: Searching a username finds that person
    When Alice searches for "bob"
    Then Alice's search shows Bob

  Scenario: The start of a name finds them
    When Alice searches for "bo"
    Then Alice's search shows Bob

  Scenario: Letter case does not matter in search
    When Alice searches for "BOB"
    Then Alice's search shows Bob

  Scenario: A person is not in their own results
    When Alice searches for "ali"
    Then Alice's search shows nobody

  Scenario: Nobody by that name means search says so instead of spinning
    When Alice searches for "zz_nobody"
    Then Alice's search shows nobody
