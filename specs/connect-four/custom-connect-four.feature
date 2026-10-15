@domain:connect-four
Feature: Configure and continue Connect Four games
  When Alice creates a Connect Four game, she wants people and bots to share the established game choices, so everyone knows who plays and what happens next.

  Rule: Both sides must be filled and every person ready before play starts

    Scenario Outline: Ready participants start playing
      Given Alice has a Connect Four custom game with <participants>
      When Alice starts the Connect Four custom game
      Then the Connect Four custom game is active

      Examples:
        | participants |
        | two ready people |
        | a ready person as Red and a bot as Yellow |
        | a bot as Red and a ready person as Yellow |
        | two bots |

    Scenario: An unfilled side prevents starting
      Given Alice has a Connect Four custom game with an open Yellow side
      When Alice starts the Connect Four custom game
      Then Alice is told both Connect Four sides need participants

  Rule: A resignation ends play and a rematch keeps the earlier game

    Scenario: A participant gives the opponent the victory
      Given Alice and Bob have an active Connect Four custom game
      When Alice resigns from Connect Four
      Then Yellow wins Connect Four by resignation

    Scenario: A watcher cannot resign for a participant
      Given Alice and Bob have an active Connect Four custom game watched by Carol
      When Carol resigns from Connect Four
      Then Carol is told she is not a Connect Four participant

    Scenario: A rematch starts a separate game with sides swapped
      Given Alice has a completed Connect Four custom game
      When Alice requests a Connect Four rematch
      Then the new Connect Four game has swapped participants and an empty board
      And the earlier Connect Four history is unchanged

  Rule: Returning after time away restores the game as it stands
    No counter-example: time away alone never gives up the game; the clock and shared away-win policy still apply.

    Scenario: A returning participant sees the opponent's drop
      Given Alice and Bob have an active Connect Four custom game and Alice is away
      And Bob has made the next Connect Four drop
      When Alice returns to Connect Four
      Then Alice and Bob see the same Connect Four board and turn
