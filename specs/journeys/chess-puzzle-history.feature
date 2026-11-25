@domain:journeys
Feature: Finishing a chess puzzle after looking back
  When a solver looks back at an earlier move, they want to return to the
  current board and finish the same puzzle.

  Rule: Looking back preserves the position the solver reached

    Scenario: A solver returns to the latest move and delivers mate
      Given a person opens the app on a fresh device
      And they are hosting a space
      When they open the shared four-move mate-in-two chess puzzle
      And they play g6-g5 on the chess puzzle board
      And they open the line after the reply and choose an earlier move
      And they close the line and return to the latest move
      And they play a2-g2 on the chess puzzle board
      Then the chess puzzle result shows Solved
