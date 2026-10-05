@domain:profile
Feature: Username rules
  When a person renames themselves, they want a username that is readable,
  unique and safe to show to other people, so everyone can tell who they
  are.

  Rule: A saved username is unique and allowed and a refused username change keeps the saved username

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

    Scenario: A username that passes someone off as the team is refused
      Given Alice is a guest
      When Alice tries to use username "official_support"
      Then Alice's username change is refused with "That username is not allowed"

    Scenario: A username that only holds an offensive word inside an ordinary word is saved
      Given Alice is a guest
      When Alice tries to use username "scunthorpe_fan"
      Then Alice's profile shows @scunthorpe_fan

    Scenario: A username change moments after the last one is refused
      Given Alice has just renamed themselves to @alice_one
      When Alice tries to use username "alice_two"
      Then Alice's username change is refused with "Username was changed recently"
      And Alice's profile still shows @alice_one

    Scenario: A username change without a connection is refused
      Given Alice's username is @alice_one
      And Alice is offline
      When Alice tries to use username "alice_two"
      Then Alice's username change is refused with "You're offline"
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
      Then Bob's username change is refused with "Username is taken"

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
      Then Alice's username change is refused with "That username is not allowed"
      And Alice's profile still shows a stand-in name

    Scenario: A device without a connection shows the stand-in name at once
      Given Alice is offline
      When the team stops allowing the username @chess_cheater
      Then Alice's profile shows a stand-in name
