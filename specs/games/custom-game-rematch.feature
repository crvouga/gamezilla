@domain:games
Feature: Keep earlier custom games through a rematch
  When a custom game finishes, people want its moves and result kept, so a new custom game never replaces what they already played.

  Rule: A new custom game and a rematch keep the earlier move list and result

    Scenario: A rematch leaves the earlier resignation available to review
      Given Alice has resigned a custom game after her first move
      When Alice asks for a rematch
      Then the earlier custom game still shows her move and its resignation
      And the new custom game has no moves

    Scenario: A new custom game cannot overwrite unfinished moves
      Given Alice and Bob have a custom game after Alice's first move
      When Alice creates a custom game
      Then Alice is told the custom game must finish or be cancelled first
      And the move list is unchanged

  Rule: A rematch keeps the people still in the space and the bots, and no invitation

    Scenario: A departed participant leaves an open side in the rematch
      Given Alice has a finished custom game
      And Bob has left the space
      When Alice asks for a rematch
      Then a new custom game is being set up with no moves
      And the first side is open
      And the second side is Alice

    Scenario: A cancelled invitation is not kept by the rematch
      Given Alice has a cancelled custom game that invited Bob to the second side
      When Alice asks for a rematch
      Then a new custom game is being set up with no moves
      And the first side is open
      And the second side is Alice
      And neither side has an invitation
