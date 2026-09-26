@domain:spaces @goal:spaces:5
Feature: Disconnect and reconnect
  Leaving, losing connection, closing the app, and coming back all leave the
  space in a correct state. Nobody appears twice. Nobody lingers after they have gone.

  Background:
    Given Alice is hosting a space that Bob joined from the link
    And Alice sees 2 people in the space within 20 seconds

  Scenario: A guest disconnected when the host ends sees the ended space on reconnect
    When Bob loses the connection
    Then Alice sees 1 person in the space within 20 seconds
    When Alice ends the space
    And the connection comes back
    Then Bob sees the space has ended within 20 seconds
    And Bob is not offered to join

  Scenario: Losing the connection and getting it back leaves Bob there once
    When Bob loses the connection
    Then Alice sees 1 person in the space within 20 seconds
    When the connection comes back
    Then Alice sees 2 people in the space within 20 seconds
    And Bob sees 2 people in the space within 20 seconds

  Scenario: Closing the app and coming back returns Bob to the space, once
    When Bob closes and reopens the app
    And Bob opens the space link again
    Then Bob is in the space
    And Alice sees 2 people in the space within 20 seconds
    When Bob leaves the space
    Then Alice sees 1 person in the space within 20 seconds
