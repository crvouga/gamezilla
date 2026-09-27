@domain:runtime
Feature: Addresses that lead nowhere
  A mistyped or outdated address never leaves a person stranded: the app says
  there is nothing there and offers the way back.

  Scenario: An address the app does not have says so and offers the way back
    When Alice opens an address the app does not have
    Then Alice is told there is nothing at that address
    And Alice can go back to Spaces
