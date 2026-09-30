@domain:profile
Feature: Username rules
  When a person renames themselves, they want a username that is readable,
  unique and safe to show to other people, so everyone can tell who they
  are.

  Scenario Outline: A username change refused as "<reason>" keeps the username unchanged
    Given Alice's username is @alice_one
    When Alice tries to use username "<name>"
    Then Alice's username change is refused with "<reason>"
    And Alice's profile shows @alice_one

    Examples:
      | name                              | reason                                        |
      | ab                                | Username is too short                         |
      | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | Username is too long                          |
      | no spaces!                        | Username can only use letters, numbers, and _ |

  Scenario: A disguised offensive username change is refused
    Given Alice is a guest
    When Alice tries to use username "sh1thead_99"
    Then Alice's username change is refused with "That username is not allowed"

  Scenario: A username is saved in lowercase
    Given Alice is a guest
    When Alice tries to use username "Chess_Fan_7"
    Then Alice's profile shows @chess_fan_7

  Scenario: A username draft left without saving keeps the saved username
    Given Alice's username is @alice_one
    When Alice starts renaming themselves to @never_saved and leaves without saving
    Then Alice's profile shows @alice_one

  Scenario: A username cannot be claimed twice, regardless of case
    Given Alice's username is @queen_gambit
    When Bob tries to use username "QUEEN_GAMBIT"
    Then Bob's username change is refused with "Username is taken"
