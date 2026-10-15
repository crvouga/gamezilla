@domain:chess
Feature: Keep the same shared game while its clocks are paused
  When shared play is interrupted for everyone, the participants want their agreed game and time kept, so the interruption cannot decide a winner or change anyone's rating.

  Rule: Paused multiplayer clocks spend no time at any speed
    No counter-example: only time while the multiplayer clock is running can be spent.

    Scenario Outline: A paused game cannot end on time
      Given Alice and Bob have an unfinished <speed> multiplayer game after both first moves
      And their multiplayer clocks are paused
      When 1 day passes in multiplayer chess
      Then the multiplayer game is still unfinished
      And both people keep the same time on their multiplayer clocks
      And neither person's <speed> rating has moved

      Examples:
        | speed     |
        | bullet    |
        | blitz     |
        | rapid     |
        | classical |
        | daily     |

    Scenario: A pause before either first move does not abort the game
      Given Alice is White and Bob is Black in a new 5+0 multiplayer game
      And their multiplayer clocks are paused
      When 60 seconds pass in multiplayer chess
      Then the multiplayer game is still unfinished
      And neither person's blitz rating has moved

  Rule: Resuming restores the accepted board and only the time that remained

    Scenario: Resuming a paused multiplayer game keeps its accepted moves
      Given Alice and Bob have a 5+0 multiplayer game after e4 and e5 with their multiplayer clocks paused
      When their multiplayer clocks resume
      Then Alice and Bob see the same multiplayer board with two moves
      And both people keep the same time on their multiplayer clocks
      And Alice has the multiplayer turn

    Scenario: A move cannot take effect while the multiplayer clocks are paused
      Given Alice and Bob have a 5+0 multiplayer game after e4 and e5 with their multiplayer clocks paused
      When Alice plays g1 to f3 as a multiplayer move
      Then Alice is told multiplayer chess is temporarily unavailable
      And Alice and Bob keep the same multiplayer board

    Scenario: A paused multiplayer game cannot be given up without confirmation
      Given Alice and Bob have a 5+0 multiplayer game after e4 and e5 with their multiplayer clocks paused
      When Alice resigns multiplayer chess
      Then Alice is told multiplayer chess is temporarily unavailable
      And the multiplayer game is still unfinished

    Scenario: Returning during a pause explains why shared play cannot continue yet
      Given Alice and Bob have a 5+0 multiplayer game after e4 and e5 with their multiplayer clocks paused
      When Alice opens multiplayer chess
      Then Alice sees her multiplayer board and Bob's name
      And Alice is told the multiplayer clocks are paused within 15 seconds
      And Alice can leave the multiplayer board

  Rule: A finished result and its rating are never replaced by an interruption
    No counter-example: a finished game has no clock to resume.

    Scenario: Returning finds a multiplayer result accepted before the pause
      Given Bob resigned multiplayer chess before Alice heard the multiplayer result
      And Alice has lost the connection
      When the connection comes back
      Then Alice sees she won the multiplayer game
      And Alice still has 1 rated multiplayer game at blitz

    Scenario: A paused unfinished game is not offered as a finished game record
      Given Alice and Bob have a 5+0 multiplayer game after e4 and e5 with their multiplayer clocks paused
      When Alice opens multiplayer chess
      Then Alice is not offered the game record or the final position
      And the multiplayer game is still unfinished
      And neither person's blitz rating has moved

  Rule: A resumed game records and rates only its eventual result

    Scenario: Resignation after resuming counts one rated game for each person
      Given Alice and Bob have resumed their 5+0 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice sees she won the multiplayer game
      And Alice still has 1 rated multiplayer game at blitz
      And Bob still has 1 rated multiplayer game at blitz

    Scenario: Returning to an unfinished resumed game does not rate it
      Given Alice and Bob have resumed their 5+0 multiplayer game after e4 and e5
      When Alice closes and reopens the app
      Then the multiplayer game is still unfinished
      And neither person's blitz rating has moved

  Rule: Disconnected devices alone do not pause an available multiplayer game

    Scenario: Both disconnected people find White ran out of time on return
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      And both people's devices were offline for 60 seconds while their multiplayer clocks kept running
      When the connection comes back
      Then both people see Bob won the multiplayer game because White ran out of time
      And Alice still has 1 rated multiplayer game at bullet
      And Bob still has 1 rated multiplayer game at bullet

    Scenario: A player still away after shared play resumes spends ordinary time again
      Given Alice and Bob's 5+0 multiplayer game after e4 and e5 has resumed with 40 seconds left for White
      And Alice's phone is offline
      When 20 seconds pass in multiplayer chess
      Then Bob sees 20 seconds left on White's multiplayer clock
      And the multiplayer game is still unfinished
