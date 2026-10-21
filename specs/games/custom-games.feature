@domain:games
Feature: Custom games of every game
  When Alice creates a custom game of any game, she wants people and bots to take its sides the same way, so everyone knows who plays and what happens next.

  Rule: Both sides must be taken and every person ready before a custom game starts

    Scenario Outline: Ready participants start the custom game
      Given Alice has a custom game with <participants>
      When Alice starts the custom game
      Then the custom game is under way

      Examples:
        | participants |
        | two ready people |
        | a ready person on the first side and a bot on the second side |
        | a bot on the first side and a ready person on the second side |
        | two bots |

    Scenario: An open side keeps the custom game from starting
      Given Alice has a custom game with an open second side
      When Alice starts the custom game
      Then Alice is told both sides need participants

  Rule: A resignation finishes the custom game and a rematch keeps the earlier one

    Scenario: A participant's resignation gives the opponent the victory
      Given Alice and Bob have a custom game under way
      When Alice resigns the custom game
      Then Bob wins the custom game by resignation

    Scenario: A watcher cannot resign for a participant
      Given Alice and Bob have a custom game under way watched by Carol
      When Carol resigns the custom game
      Then Carol is told she is not a participant

    Scenario: Resigning cannot replace a victory by the game's rules
      Given Alice has a finished custom game
      When Bob resigns the custom game
      Then Bob is told the game is finished
      And the finished custom game is unchanged

    Scenario: A rematch starts a new custom game with the sides swapped
      Given Alice has a finished custom game
      When Alice asks for a rematch
      Then the new custom game has the sides swapped and no moves
      And the earlier custom game is unchanged in the history

  Rule: Returning after time away shows the custom game as it stands
    No counter-example: time away alone never gives up the custom game.

    @regression:browser-room-connection-control
    Scenario: A returning participant sees the opponent's move
      Given Alice and Bob have a custom game under way and Alice is away
      And Bob has made the next move
      When Alice returns to the custom game
      Then Alice and Bob see the same board and turn

  Rule: Bots make legal moves until the custom game is finished
    No counter-example: a bot never has a turn in a finished custom game.

    Scenario: Two bots finish a custom game without help
      Given Alice has a custom game under way between two bots
      When the bots play their turns
      Then the custom game is finished with a victory or a draw
