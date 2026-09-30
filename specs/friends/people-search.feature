@domain:friends
Feature: People search
  When a person wants to find someone, they want people search to find them
  by the start of their username, in any letter case, and to always give an
  answer, so they never wait forever on "Searching…".

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
