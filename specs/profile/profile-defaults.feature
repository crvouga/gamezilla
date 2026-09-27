@domain:profile @goal:social:3
Feature: Profile defaults
  When a newcomer opens the app, they want a username and avatar of their
  own straight away, so they can play and be found without setting anything
  up.

  Scenario: Every newcomer gets a username and avatar of their own
    Given Alice and Bob are on fresh devices
    When Alice and Bob open the app
    Then Alice and Bob have different usernames
    And Alice already has an avatar
