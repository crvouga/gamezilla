@domain:chess
Feature: Keep and review earlier Custom Games
  When a game finishes, people want its moves and result kept, so a new game never replaces what they already played.

  Rule: A new game and a rematch keep the earlier move list and result

    Scenario: A rematch leaves the earlier resignation available to review
      Given Alice has a completed Custom Game after White's e4
      When Alice creates a rematch of the Custom Game
      Then The earlier Custom Game still shows e4 and its resignation outcome
      And The new Custom Game has no moves

    Scenario: A new game cannot overwrite unfinished moves
      Given Alice has an active Custom Game after White's e4
      When Alice creates a Custom Game
      Then Alice is told the Custom Game must finish or be cancelled first
      And The Custom Game move list shows e4

  Rule: A rematch inherits accepted people still in the space and bots

    Scenario: A departed participant becomes an open place in the rematch
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      And Bob has left Alice's space
      When Alice creates a rematch of the Custom Game
      Then White is an open place and Black is Alice in the configuring Custom Game

    Scenario: A cancelled invitation cannot be inherited as a participant
      Given Alice has a cancelled Custom Game that invited Bob to Black
      When Alice creates a rematch of the Custom Game
      Then White is an open place and Black is Alice in the configuring Custom Game
      And Neither side offers an invitation

  Rule: Reading an earlier game never grants control of the current game

    Scenario: A watcher reviews the earlier starting board
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol reviews move 0 of the Custom Game
      Then Carol sees the Custom Game starting board

    Scenario: An outsider cannot review an earlier game
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      And Carol is outside Alice's space
      When Carol tries to watch the Custom Game
      Then Carol cannot see the Custom Game
