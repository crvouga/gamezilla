@domain:profile @goal:social:3
Feature: Profile defaults

  Scenario: A first-time guest gets a distinct username and avatar
    Given Alice and Bob are guests
    Then each has their own generated username
    And Alice has a generated avatar seed
