@domain:spaces @goal:works-offline:6
Feature: Spaces need a connection
  Spaces are live and shared, so they need a connection. Without one, the app
  says so plainly instead of failing silently or waiting forever.

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
