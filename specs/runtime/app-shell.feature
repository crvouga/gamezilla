@domain:runtime
Feature: The tabs and Settings
  When a person opens the app, they want to land on the tabs and reach
  Settings from there, so they can get anywhere in the app. Each device keeps
  its own place in the app, whoever else is using theirs.

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
