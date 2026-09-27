@domain:runtime
Feature: Addresses that lead nowhere
  When a person opens an address that leads nowhere, mistyped or outdated,
  they want to be told so and offered the way back, so they are never
  stranded.

  Scenario: An address the app does not have says so and offers the way back
    When Alice opens an address the app does not have
    Then Alice is told there is nothing at that address
    And Alice is offered the way back to Spaces

  Scenario: The way back from an address that leads nowhere reaches Spaces
    Given Alice has opened an address the app does not have
    When Alice takes the way back to Spaces
    Then Alice is on Spaces
