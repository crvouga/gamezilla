@domain:spaces @goal:spaces:2 @goal:social:1
Feature: Join a space from its link
  Anyone with a space's link can join it, including a guest with no account.

  Scenario: A guest with no account opens the link and joins the space
    Given Alice is a guest
    And Bob is a guest
    When Alice creates a space
    Then Alice has a link to the space
    When Bob joins the space from the link
    Then Bob is in the space
    And Bob sees 2 people in the space within 15 seconds
    And Alice sees 2 people in the space within 15 seconds
