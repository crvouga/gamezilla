@domain:chess
Feature: Offer a draw in a Custom Game
  When an active game has no clear winner, a participant wants to offer a draw, so ending by agreement remains the other person's choice.

  Rule: A draw offer comes from a participant in a game between two people

    Scenario: White offers Black a draw
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice offers a draw in the Custom Game
      Then Bob is offered a draw in the Custom Game

    Scenario: A draw cannot be offered to a bot
      Given Alice has an active Custom Game against a bot as Black
      When Alice offers a draw in the Custom Game
      Then Alice is told draw agreement needs two people

  Rule: Declining a draw keeps the game active

    Scenario: Black declines White's offer
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice has offered a draw in the Custom Game
      When Bob declines the draw in the Custom Game
      Then The Custom Game remains active
      And Neither person is offered a draw in the Custom Game

    Scenario: White cannot decline for Black
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice has offered a draw in the Custom Game
      When Alice declines the draw in the Custom Game
      Then Alice is told only the other participant may decline a draw

  Rule: A legal move clears a waiting draw offer

    Scenario: Black's reply clears White's offer
      Given Alice has an active Custom Game after White's e4
      And Alice has offered a draw in the Custom Game
      When Bob plays e7-e5 in the Custom Game
      Then Neither person is offered a draw in the Custom Game

    Scenario: An illegal move cannot clear an offer
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice has offered a draw in the Custom Game
      When Bob plays e7-e5 in the Custom Game
      Then Bob is told only the participant to move may play
      And Bob is offered a draw in the Custom Game

  Rule: A repeated position three times completes the game as a draw

    Scenario: The third repetition ends the game
      Given Alice has a Custom Game one move before the third repetition
      When Bob plays f6-g8 in the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: A second repetition leaves the game active
      Given Alice has a Custom Game one move before the second repetition
      When Bob plays f6-g8 in the Custom Game
      Then The Custom Game remains active
      And Neither person has won the Custom Game
