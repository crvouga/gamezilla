@domain:spaces @goal:spaces:5
Feature: Disconnect and reconnect
  Leaving, losing connection, closing the app, and coming back all leave the
  space in a correct state. Nobody appears twice. Nobody lingers after they have gone.

  Background:
    Given Alice is hosting a space that Bob joined from the link

  Rule: Nobody lingers after they have gone

    Scenario: Someone stops showing as there after losing the connection
      When Bob loses the connection
      Then Alice sees 1 person in the space within 20 seconds

    Scenario: Leaving after coming back leaves no trace
      Given Bob has come back to the space after closing the app
      When Bob leaves the space
      Then Alice sees 1 person in the space within 20 seconds

  Rule: Nobody appears twice

    Scenario: Someone whose connection comes back is there once
      Given Bob has lost the connection long enough to drop out of the space
      When the connection comes back
      Then Alice sees 2 people in the space within 20 seconds
      And Bob sees 2 people in the space within 20 seconds

    Scenario: Closing the app and coming back returns Bob to the space once
      Given Bob has closed and reopened the app
      When Bob opens the space link again
      Then Bob is in the space
      And Alice sees 2 people in the space within 20 seconds

  Rule: Someone away when the space ends finds out when they are back

    Scenario: Someone offline when the space ends learns it ended on reconnect
      Given Bob has lost the connection long enough to drop out of the space
      And Alice has ended the space
      When the connection comes back
      Then Bob sees the space has ended within 20 seconds
      And Bob is not offered to join
