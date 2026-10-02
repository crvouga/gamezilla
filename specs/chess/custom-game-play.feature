@domain:chess
Feature: Play the Custom Game
  When a Custom Game is active, each participant wants legal moves and a final result, so people and bots follow the same chess rules.

  Rule: Only the participant to move plays legal moves

    Scenario: White plays a legal opening move
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice plays e2-e4 in the Custom Game
      Then Black is to move in the Custom Game
      And The Custom Game move list shows e4

    Scenario: Black cannot move first
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob plays e7-e5 in the Custom Game
      Then Bob is told only the participant to move may play

    Scenario: An illegal move leaves the board unchanged
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice plays e2-e5 in the Custom Game
      Then Alice is told the move is illegal
      And White is to move in the Custom Game

    Scenario: No move is allowed before start
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Alice plays e2-e4 in the Custom Game
      Then Alice is told the Custom Game has not started

    Scenario: A completed game refuses further moves
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice plays e2-e4 in the Custom Game
      Then Alice is told the Custom Game has finished

    Scenario: A cancelled game refuses further moves
      Given Alice has a cancelled Custom Game
      When Alice plays e2-e4 in the Custom Game
      Then Alice is told the Custom Game was cancelled

  Rule: Bots play only their own turn and stop when the game ends

    Scenario: A bot answers a person's opening move
      Given Alice has an active Custom Game against a bot as Black
      When Alice plays e2-e4 in the Custom Game
      Then A legal Black bot move follows within 5 seconds
      And White is to move in the Custom Game

    Scenario: A bot cannot continue a cancelled game
      Given Alice has an active Custom Game against a bot as Black
      And Alice has cancelled the Custom Game
      When 5 seconds pass
      Then The Custom Game move list is unchanged
      And The Custom Game is cancelled with no winner

  Rule: Checkmate ends the game immediately

    Scenario: The mating move awards Black the game
      Given Alice has an active Custom Game one move before Black's checkmate
      When Bob plays d8-h4 in the Custom Game
      Then Bob wins the Custom Game by checkmate

    Scenario: Resigning cannot replace checkmate
      Given Alice has a Custom Game completed by Black's checkmate
      When Alice resigns the Custom Game
      Then Alice is told the Custom Game has finished
      And Bob wins the Custom Game by checkmate

  Rule: A draw needs agreement or a drawn chess position

    Scenario: Accepting a draw ends the game without a winner
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice has offered a draw in the Custom Game
      When Bob accepts the draw in the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: A watcher cannot accept a draw
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice has offered a draw in the Custom Game
      And Carol is in Alice's space
      When Carol accepts the draw in the Custom Game
      Then Carol is told only the other participant may accept a draw

  Rule: Finished moves can be reviewed without changing the result

    Scenario: A person reviews a finished game
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice reviews move 0 of the Custom Game
      Then Alice sees the Custom Game starting board
      And The Custom Game keeps its completed outcome

    Scenario: Review cannot select a move that never happened
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice reviews move 99 of the Custom Game
      Then Alice is told that move is not in the Custom Game
