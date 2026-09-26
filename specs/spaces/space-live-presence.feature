@domain:spaces @goal:spaces:4
Feature: Live presence
  Everyone in a space sees who else is there, live.

  Scenario: Everyone sees who is there, and who has left
    Given Alice is hosting a space that Bob joined from the link
    Then Alice sees 2 people in the space within 20 seconds
    And Bob sees 2 people in the space within 20 seconds
    When Bob leaves the space
    Then Alice sees 1 person in the space within 20 seconds
