@domain:runtime
Feature: The tabs and Settings
  When a person opens the app, they want to land on the tabs and reach
  Settings from there, so they can get anywhere in the app.

  Rule: Opening the app lands on Spaces
    No counter-example: the app has one home, Spaces, and Settings is reached from the tabs.

    Scenario: A person who opens the app lands on Spaces
      When Alice opens the app
      Then Alice sees the tabs
      And Alice is on Spaces

  Rule: A person moves freely between the tabs
    No counter-example: every tab is open to every person, including a guest.

    Scenario: Opening Notifications lands on Notifications
      When Alice opens the Notifications tab
      Then Alice is on Notifications

    Scenario: Opening Profile lands on Profile
      When Alice opens the Profile tab
      Then Alice is on Profile

  Rule: Settings is open from the tabs, and each device keeps its own place

    Scenario: A guest can open Settings
      Given Bob is a guest
      When Bob opens Settings
      Then Bob is on Settings

    Scenario: Each person's app keeps its own place
      Given Alice and Bob are guests
      When Bob opens Settings
      Then Bob is on Settings
      And Alice is still on Spaces
