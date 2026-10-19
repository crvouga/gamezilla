@domain:games
Feature: The account playing a custom game keeps its side
  When someone signs in or out or changes their username, they want the same account to keep its side, so a device never keeps another person's side.

  Rule: Signing in to the participating account gives back its current side

    Scenario: A returning account keeps its accepted side
      Given Bob has a recently proven account
      And Alice and Bob have a custom game under way
      And Bob has signed out
      When Bob signs in with Google
      Then the second side is Bob
      And Bob sees the custom game under way with the first side to move

    Scenario: Signing out takes the account's custom game away from that device
      Given Bob has a recently proven account
      And Alice and Bob have a custom game under way
      When Bob signs out
      Then Bob cannot see the custom game
      And Alice still sees the custom game under way with the first side to move

  Rule: Changing a username changes the person's name without changing their side
    No counter-example: Identity decides a username change; the custom game shows the same participant under that name.

    Scenario: The participating person appears under their new name
      Given Alice and Bob have a custom game under way
      When Alice renames themselves to @calm_rook
      Then the first side is named @calm_rook
      And it is Alice's turn
