@domain:games
Feature: Keep the same matched game while its clocks are paused
  When play is interrupted for everyone, the two people want their matched game and time kept, so the interruption cannot decide a winner or change anyone's rating.

  Rule: Paused clocks spend no time at any speed
    No counter-example: only time while the clock is running can be spent.

    Scenario Outline: A paused matched game cannot end on time
      Given Alice and Bob have an unfinished <speed> matched game after their first moves
      And their clocks are paused
      When 1 day passes
      Then the matched game is still unfinished
      And both people keep the same time on their clocks
      And neither person's <speed> rating has changed

      Examples:
        | speed     |
        | bullet    |
        | blitz     |
        | rapid     |
        | classical |
        | daily     |

    Scenario: A pause before either first move does not abort the matched game
      Given Alice has the first side against Bob in a new 5+0 matched game
      And their clocks are paused
      When 60 seconds pass
      Then the matched game is still unfinished
      And neither person's blitz rating has changed

  Rule: Resuming restores the accepted board and only the time that remained

    Scenario: Resuming a paused matched game keeps its accepted moves
      Given Alice and Bob have a 5+0 matched game after their first moves with their clocks paused
      When their clocks resume
      Then both people see the two moves played
      And both people keep the same time on their clocks
      And it is Alice's turn

    Scenario: A move cannot take effect while the clocks are paused
      Given Alice and Bob have a 5+0 matched game after their first moves with their clocks paused
      When Alice makes her move
      Then Alice is told the matched game is paused
      And Alice and Bob keep the same matched game and board

    Scenario: A paused matched game cannot be given up
      Given Alice and Bob have a 5+0 matched game after their first moves with their clocks paused
      When Alice resigns the matched game
      Then Alice is told the matched game is paused
      And the matched game is still unfinished

    Scenario: Returning during a pause explains why play cannot go on yet
      Given Alice and Bob have a 5+0 matched game after their first moves with their clocks paused
      When Alice opens finding an opponent
      Then Alice sees her board and Bob as her opponent
      And Alice is told the clocks are paused within 15 seconds
      And Alice can go back to the game's choices

  Rule: A finished result and its rating are never replaced by an interruption
    No counter-example: a finished matched game has no clock to resume.

    Scenario: Returning finds a result accepted before the pause
      Given Bob resigned the matched game before Alice heard the result
      And Alice has lost the connection
      When the connection comes back
      Then Alice sees she won the matched game
      And Alice still has 1 rated matched game at blitz

    Scenario: A paused unfinished matched game is not offered as a finished game record
      Given Alice and Bob have a 5+0 matched game after their first moves with their clocks paused
      When Alice opens finding an opponent
      Then Alice is not offered the game record or the final position
      And the matched game is still unfinished
      And neither person's blitz rating has changed

  Rule: A resumed matched game records and rates only its eventual result

    Scenario: Resignation after resuming counts one rated matched game for each person
      Given Alice and Bob have resumed their 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then Alice sees she won the matched game
      And Alice still has 1 rated matched game at blitz
      And Bob still has 1 rated matched game at blitz

    Scenario: Returning to an unfinished resumed matched game does not rate it
      Given Alice and Bob have resumed their 5+0 matched game after their first moves
      When Alice closes and reopens the app
      Then the matched game is still unfinished
      And neither person's blitz rating has changed

  Rule: Devices without a connection alone do not pause a matched game

    Scenario: Both people without a connection find the first side ran out of time on return
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      And both people's devices were offline for 60 seconds while their clocks kept running
      When the connection comes back
      Then both people see Bob won the matched game on time
      And Alice still has 1 rated matched game at bullet
      And Bob still has 1 rated matched game at bullet

    Scenario: A person still away after play resumes spends ordinary time again
      Given Alice and Bob's 5+0 matched game after their first moves has resumed with 40 seconds left for the first side
      And Alice's phone is offline
      When 20 seconds pass
      Then Bob sees 20 seconds left on the first side's clock
      And the matched game is still unfinished
