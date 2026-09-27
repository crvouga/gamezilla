@domain:spaces @goal:spaces:1
Feature: A guest can host
  Anyone, including a guest with no account, can create a space and host it.

  Scenario: A guest creates a space and hosts it
    Given Alice is a guest
    When Alice creates a space
    Then Alice is in the space

  Scenario: A guest host can end their own space
    Given Alice is a guest
    And Alice is hosting a space
    When Alice ends the space
    Then Alice is not in a space
