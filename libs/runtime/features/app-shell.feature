@domain:runtime
Feature: App shell
  Opening the app lands a person on the tabs, from where they can reach
  Settings. Several people can use the app side by side, and each person's
  app stays where they left it.

  @goal:social:1
  Scenario: Two people open the app and land on the tabs
    When Alice opens the app
    Then Alice sees the tabs
    When Bob opens the app
    Then Bob sees the tabs
    And only Alice and Bob are using the app

  Scenario: A person can open Settings from the tabs
    Given Alice and Bob are guests
    When Bob opens Settings
    Then Bob is on Settings

  Scenario: Switching between people keeps each person's place
    Given Alice and Bob are guests
    And Bob opens Settings
    When the view switches to Alice's device
    Then Alice sees the tabs
    And Alice is on Spaces
    And Alice is not on Settings
    When the view switches to Bob's device
    Then Bob is on Settings
