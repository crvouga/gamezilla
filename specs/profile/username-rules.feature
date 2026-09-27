@domain:profile @goal:social:3 @goal:social:4
Feature: Username rules
  Names are readable, unique, and safe to show to other people.

  Scenario Outline: A username refused as "<reason>" leaves the name unchanged
    Given Alice's username is @alice_one
    When Alice tries to use username "<name>"
    Then Alice's username change is refused with "<reason>"
    And Alice's profile shows @alice_one

    Examples:
      | name                              | reason                                        |
      | ab                                | Username is too short                         |
      | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | Username is too long                          |
      | no spaces!                        | Username can only use letters, numbers, and _ |

  Scenario: A disguised offensive username is refused
    Given Alice is a guest
    When Alice tries to use username "sh1thead_99"
    Then Alice's username change is refused with "That username is not allowed"

  Scenario: A username is saved in lowercase
    Given Alice is a guest
    When Alice tries to use username "Chess_Fan_7"
    Then Alice's profile shows @chess_fan_7

  Scenario: Leaving a username draft without saving keeps the saved name
    Given Alice's username is @alice_one
    When Alice starts renaming themselves to @never_saved and leaves without saving
    Then Alice's profile shows @alice_one

  Scenario: A username cannot be claimed twice, regardless of case
    Given Alice's username is @queen_gambit
    When Bob tries to use username "QUEEN_GAMBIT"
    Then Bob's username change is refused with "Username is taken"
