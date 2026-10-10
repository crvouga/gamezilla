@domain:profile
Feature: Username rules
  When a person renames themselves, they want a username that is readable,
  unique and safe to show to other people, so everyone can tell who they
  are.

  Rule: A saved username is unique and allowed and a refused username change keeps the saved username

    Scenario Outline: A refused username change keeps the saved username
      Given Alice's username is @alice_one
      When Alice tries to use username "<name>"
      Then Alice's username change is refused because <reason>
      And Alice's profile shows @alice_one

      Examples:
        | name                              | reason                                        |
        | ab                                | it is too short                         |
        | alice_plays_chess_after_supper_2026 | it is too long                          |
        | Alice Woods                        | it contains characters other than letters, numbers and _ |

    Scenario: A disguised offensive username change is refused
      Given Alice is a guest
      When Alice tries to use username "sh1thead_99"
      Then Alice's username change is refused because the name is not allowed

    Scenario: A username that passes someone off as the team is refused
      Given Alice is a guest
      When Alice tries to use username "official_support"
      Then Alice's username change is refused because the name is not allowed

    Scenario: A username that only holds an offensive word inside an ordinary word is saved
      Given Alice is a guest
      When Alice tries to use username "scunthorpe_fan"
      Then Alice's profile shows @scunthorpe_fan

    Scenario: A username change moments after the last one is refused
      Given Alice has renamed themselves to @alice_one
      When Alice tries to use username "alice_two"
      Then Alice's username change is refused because their username was changed recently
      And Alice's profile still shows @alice_one

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
      Then Bob's username change is refused because another person already has that name

  Rule: A username the team stops allowing is kept but shows as a stand-in name until the person renames themselves

    Background:
      Given Alice's username is @chess_cheater

    Scenario: A username the team stops allowing shows as a stand-in name
      When the team stops allowing the username @chess_cheater
      Then Alice's profile shows a stand-in name
      And Alice is told other people see a stand-in name until they rename themselves

    Scenario: A username the team starts allowing again shows as it was
      Given the team has stopped allowing the username @chess_cheater
      When the team starts allowing the username @chess_cheater again
      Then Alice's profile shows @chess_cheater

    Scenario: Renaming themselves replaces the stand-in name
      Given the team has stopped allowing the username @chess_cheater
      When Alice renames themselves to @alice_one
      Then Alice's profile shows @alice_one

    Scenario: A username that is no longer allowed cannot be saved again
      Given the team has stopped allowing the username @chess_cheater
      When Alice tries to use username "chess_cheater"
      Then Alice's username change is refused because the name is not allowed
      And Alice's profile still shows a stand-in name

    @regression:offline-app-learns-unavailable-naming-rules
    Scenario: An offline device keeps the username it already knew
      Given Alice is offline
      When the team stops allowing the username @chess_cheater
      Then Alice's profile shows @chess_cheater

    Scenario: A returning device applies the username rules it learns
      Given Alice is offline
      And the team has stopped allowing the username @chess_cheater
      When the connection comes back
      Then Alice's profile shows a stand-in name
