@domain:chess
Feature: Identity follows the person playing a Custom Game
  When someone signs in or out or changes their username, they want the same account to retain its side, so a device never keeps another person's control.

  Rule: Signing in to the participating account restores its current side

    Scenario: A returning account controls its accepted side
      Given Bob has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      And Bob has signed out
      When Bob signs in with Google
      Then Black is Bob in the Custom Game
      And Bob sees the active Custom Game with White to move

    Scenario: Signing out removes that device's access to the account's game
      Given Bob has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob signs out
      Then Bob cannot see the Custom Game
      And Alice still sees the active Custom Game with White to move

  Rule: Changing a username changes the person's name without changing their side
    No counter-example: Identity decides a username change; Chess describes the same participant with that name.

    Scenario: The participating person appears under their new name
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice renames themselves to "CalmRook"
      Then White in the Custom Game is named "CalmRook"
      And White is to move in the Custom Game
