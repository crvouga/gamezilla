@domain:spaces
Feature: Leave a space as a guest while its host is offline
  When a space's host is offline, a guest who joined wants to leave, so
  they do not need an account or the host's return to go out for good.

  Background:
    Given Bob is a guest
    And Alice is hosting a space that Bob joined from the link
    And Alice is offline

  Rule: A guest who joined may leave with or without a connection
    No counter-example: nobody else has to agree when a person leaves.

    Scenario: A joined guest is still offered to leave while the host is offline
      When Bob opens Alice's space link
      Then Bob can leave the space

    Scenario: A joined guest leaves while the host is offline
      When Bob leaves the space
      Then Bob sees they have left the space

    Scenario: A joined guest leaves without either person's connection
      Given Bob is offline
      When Bob leaves the space
      Then Bob sees they have left the space

    Scenario: Returning does not bring back a guest who left offline
      Given Bob is offline
      And Bob has left the space
      When the connection comes back
      Then Bob sees they have left the space
      And Alice sees 1 person in the space within 20 seconds
