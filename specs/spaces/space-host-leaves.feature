@domain:spaces
Feature: The host leaving ends the space
  When a host leaves their space, loses the connection or closes the app,
  everyone in it wants to know whether the space is still open, so people
  can tell leaving from being away.

  Rule: The host leaving ends the space and losing the connection or closing the app does not
    No counter-example: leaving always ends the host's space; closing the app or losing the connection never counts as leaving.

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
      When Alice returns to their space
      Then Alice is in the space
      And Bob sees 2 people in the space within 20 seconds

    Scenario: An offline host sees their space end when they leave
      Given Alice is offline
      When Alice leaves the space
      Then Alice sees the space has ended within 20 seconds
      And Bob is told the host is offline within 20 seconds

    Scenario: Returning after the offline host left tells the other person the space ended
      Given Alice is offline
      And Alice has left the space
      When the connection comes back
      Then Bob sees the space has ended within 20 seconds
      And Bob is not offered to join

  Rule: Other people are disconnected while the host is offline and the host keeps their space

    Background:
      Given Alice is hosting a space that Bob joined from the link

    @regression:space-host-offline-guests-stay
    Scenario: Losing the host's connection disconnects the other person
      When Alice loses the connection
      Then Alice is in the space
      And Alice sees 1 person in the space within 20 seconds
      And Bob is told the host is offline within 20 seconds
      And Bob is not offered to join

    Scenario: The host's return restores the same space and its people once
      Given Alice has lost the connection long enough to drop out of the space
      When the connection comes back
      Then Alice is in the space
      And Alice sees 2 people in the space within 20 seconds
      And Bob sees 2 people in the space within 20 seconds

    Scenario: A space ended by its offline host stays ended on return
      Given Alice is offline
      And Alice has ended the space
      When the connection comes back
      Then Bob sees the space has ended within 20 seconds
      And Bob is not offered to join
