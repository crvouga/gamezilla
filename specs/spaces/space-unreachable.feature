@domain:spaces
Feature: Return to a space that can't be reached
  When a person returns to a space the app can't reach, such as one their
  lobby still lists that no longer exists, they want to be told so with a way
  forward, so they never wait without end.

  Rule: Returning to a space that can't be reached says so within 15 seconds

    Scenario: A host who closes the app finds their space again
      Given Alice is hosting a space
      And Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice is in the space

    Scenario: Returning to a space that no longer exists says it can't be reached
      Given Alice's lobby still lists a space Alice hosted that no longer exists
      When Alice returns to their space
      Then Alice is told the space can't be reached right now within 15 seconds
      And Alice is offered to try again
      And Alice is offered the way back to Spaces

    Scenario: Trying again while the space still can't be reached says so again
      Given Alice's lobby still lists a space Alice hosted that no longer exists
      And Alice has been told the space can't be reached right now
      When Alice tries again
      Then Alice is still told the space can't be reached right now within 15 seconds

  Rule: Without a connection a host returns to their space as before, and is told once back

    Scenario: A host without a connection is in their space as before
      Given Alice's lobby still lists a space Alice hosted that no longer exists
      And Alice is offline
      When Alice returns to their space
      Then Alice is in the space

    Scenario: A host back online is told their space can't be reached
      Given Alice's lobby still lists a space Alice hosted that no longer exists
      And Alice has returned to their space while offline
      When the connection comes back
      Then Alice is told the space can't be reached right now within 15 seconds
      And Alice is offered the way back to Spaces
