@domain:spaces
Feature: Spaces need a connection
  When a person has no connection and tries to create or join a space, they
  want to be told that spaces need a connection, so they are never left
  waiting on something that cannot happen.

  @regression:space-offline-create-queued
  Scenario: Creating a space without a connection says it needs one
    Given Alice is signed in
    And Alice is offline
    When Alice creates a space
    Then Alice is told spaces need a connection within 15 seconds
    And Alice is not in a space

  Scenario: Joining from a link without a connection says it needs one
    Given Alice and Bob are guests
    And Alice is hosting a space
    And Bob is offline
    When Bob joins the space from the link
    Then Bob is told spaces need a connection within 15 seconds

  Scenario: A space can be created once the connection comes back
    Given Alice is signed in
    And Alice is offline
    And the connection has come back
    When Alice creates a space
    Then Alice is in the space
