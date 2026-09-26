@domain:profile @goal:social:3 @goal:social:4
Feature: Username rules
  Names are readable, unique, and safe to show to other people.

  Scenario: A too-short username is refused without changing the current name
    Given Alice's current username is recorded
    When Alice tries to use username "ab"
    Then Alice's username change is refused with "Username is too short"
    And Alice's profile keeps the loaded username

  Scenario: A too-long username is refused
    Given Alice is editing their profile
    When Alice tries to use username "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    Then Alice's username change is refused with "Username is too long"

  Scenario: Characters outside the allowed set are refused
    Given Alice is editing their profile
    When Alice tries to use username "no spaces!"
    Then Alice's username change is refused with "Username can only use letters, numbers, and _"

  Scenario: Disallowed words and disguised spellings are refused
    Given Alice is editing their profile
    When Alice tries to use username "fuckface"
    Then Alice's username change is refused with "That username is not allowed"
    When Alice tries to use username "sh1thead_99"
    Then Alice's username change is refused with "That username is not allowed"

  Scenario: Accepted mixed case is stored in lowercase
    Given Alice is editing their profile
    When Alice tries to use username "Mixed_Case_1"
    Then Alice's username change is saved
    And Alice's profile shows username "mixed_case_1"

  Scenario: Cancelling a username draft leaves the saved name unchanged
    Given Alice's current username is recorded
    When Alice drafts username "never_saved" and cancels
    Then Alice's profile still shows the loaded username

  Scenario: A username cannot be claimed twice, regardless of case
    Given Alice has claimed username "taken_name"
    And Bob is editing their profile
    When Bob tries to use username "TAKEN_NAME"
    Then Bob's username change is refused with "Username is taken"
