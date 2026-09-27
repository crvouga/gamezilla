@domain:spaces @goal:spaces:4
Feature: Live presence
  Everyone in a space sees who else is there, live.

  Scenario: Everyone in a space sees who is there
    Given Alice is hosting a space
    When Bob joins the space from the link
    Then Alice sees 2 people in the space within 20 seconds
    And Bob sees 2 people in the space within 20 seconds

  Scenario: Someone stops showing as there after leaving
    Given Alice is hosting a space that Bob joined from the link
    When Bob leaves the space
    Then Alice sees 1 person in the space within 20 seconds
