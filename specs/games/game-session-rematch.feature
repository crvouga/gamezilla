@domain:games
Feature: Keep earlier game sessions through a rematch
  When a game session finishes, people want its moves and result kept, so a new game session never replaces what they already played.

  Rule: A new game session and a rematch keep the earlier move list and result

    Scenario: A rematch leaves the earlier resignation available to review
      Given Alice has resigned a game session after her first move
      When Alice asks for a rematch
      Then the earlier game session still shows her move and its resignation
      And the new game session has no moves

    Scenario: A new game session cannot overwrite unfinished moves
      Given Alice and Bob have a game session after Alice's first move
      When Alice creates a game session
      Then Alice is told the game session must finish or be cancelled first
      And the move list is unchanged

  Rule: A rematch keeps the people still in the space and the bots, and no invitation

    Scenario: A departed participant leaves an open side in the rematch
      Given Alice has a finished game session
      And Bob has left the game session's space
      When Alice asks for a rematch
      Then a new game session is being set up with no moves
      And the first side is open
      And the second side is Alice

    Scenario: A cancelled invitation is not kept by the rematch
      Given Alice has a cancelled game session that invited Bob to the second side
      When Alice asks for a rematch
      Then a new game session is being set up with no moves
      And the first side is open
      And the second side is Alice
      And neither side has an invitation
