@domain:games
Feature: Game sessions of every game
  When Alice creates a game session of any game, she wants people and bots to take its sides the same way, so everyone knows who plays and what happens next.

  Rule: Both sides must be taken and every person ready before a game session starts

    Scenario Outline: Ready participants start the game session
      Given Alice has a game session with <participants>
      When Alice starts the game session
      Then the game session is under way

      Examples:
        | participants |
        | two ready people |
        | a ready person on the first side and a bot on the second side |
        | a bot on the first side and a ready person on the second side |
        | two bots |

    Scenario: An open side keeps the game session from starting
      Given Alice has a game session with an open second side
      When Alice starts the game session
      Then Alice is told both sides need participants

  Rule: A resignation finishes the game session and a rematch keeps the earlier one

    Scenario: A participant's resignation gives the opponent the victory
      Given Alice and Bob have a game session under way
      When Alice resigns the game session
      Then Bob wins the game session by resignation

    Scenario: A watcher cannot resign for a participant
      Given Alice and Bob have a game session under way watched by Carol
      When Carol resigns the game session
      Then Carol is told she is not a participant

    Scenario: Resigning cannot replace a victory by the game's rules
      Given Alice has a finished game session
      When Bob resigns the game session
      Then Bob is told the game is finished
      And the finished game session is unchanged

    Scenario: A rematch starts a new game session with the sides swapped
      Given Alice has a finished game session
      When Alice asks for a rematch
      Then the new game session has the sides swapped and no moves
      And the earlier game session is unchanged in the history

  Rule: Returning after time away shows the game session as it stands
    No counter-example: time away alone never gives up the game session.

    @regression:browser-room-connection-control
    Scenario: A returning participant sees the opponent's move
      Given Alice and Bob have a game session under way and Alice is away
      And Bob has made the next move
      When Alice returns to the game session
      Then Alice and Bob see the same board and turn

  Rule: Bots make legal moves until the game session is finished
    No counter-example: a bot never has a turn in a finished game session.

    Scenario: Two bots finish a game session without help
      Given Alice has a game session under way between two bots
      When the bots play their turns
      Then the game session is finished with a victory or a draw
