@domain:runtime
Feature: App shell
  Opening the app lands a person on the tabs, from where they can reach
  Settings. Several people can use the app side by side, and each person's
  app stays where they left it.

  @goal:social:1
  Scenario: A person who opens the app lands on Spaces
    When Alice opens the app
    Then Alice sees the tabs
    And Alice is on Spaces

  Scenario: A guest can open Settings
    Given Bob is a guest
    When Bob opens Settings
    Then Bob is on Settings

  Scenario: Each person's app keeps its own place
    Given Alice and Bob are guests
    And Bob has opened Settings
    When the view switches to Alice's device
    Then Alice is on Spaces
    And Bob is still on Settings
