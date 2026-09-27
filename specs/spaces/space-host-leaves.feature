@domain:spaces @goal:spaces:5
Feature: The host leaving ends the space
  A space belongs to its host: when the host leaves, the space ends for
  everyone, so nobody waits in a space nobody is running. Losing the
  connection or closing the app is not leaving, so a host who comes back
  finds their space as they left it.

  Background:
    Given Alice is hosting a space that Bob joined from the link

  Scenario: When the host leaves, the space ends for everyone in it
    When Alice leaves the space
    Then Bob sees the space has ended within 15 seconds
    And Alice is not in a space

  Scenario: A host who loses the connection still hosts the space when it comes back
    Given Alice has been without a connection for 5 minutes
    When the connection comes back
    Then Alice is in the space
    And Alice sees 2 people in the space within 20 seconds

  Scenario: A host who closes the app still hosts the space on return
    Given Alice has closed and reopened the app
    When Alice reopens their live space
    Then Alice is in the space
    And Bob sees 2 people in the space within 20 seconds
