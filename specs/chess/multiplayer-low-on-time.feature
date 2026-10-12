@domain:chess
Feature: A multiplayer clock that is low on time
  When a person's multiplayer clock is nearly used up, they want to see it
  shown as low on time and hear the low on time warning, so running out of
  time never takes them by surprise.

  Rule: A running multiplayer clock is low on time once it has no more than 10 seconds left at bullet, 20 seconds at blitz, 30 seconds at rapid or 60 seconds at classical
    No counter-example: nobody can make a multiplayer clock show otherwise than this rule says; the examples show a clock at that time and one second above it.

    Scenario Outline: At <speed> a multiplayer clock with <left> seconds left is low on time
      Given Alice is White and Bob is Black in a <time control> multiplayer game after e4 and e5
      When <passed> seconds pass in multiplayer chess
      Then both people see White's multiplayer clock is low on time

      Examples:
        | speed     | time control | passed | left |
        | bullet    | 1+0          | 50     | 10   |
        | blitz     | 3+0          | 160    | 20   |
        | rapid     | 10+0         | 570    | 30   |
        | classical | 30+0         | 1740   | 60   |

    Scenario Outline: At <speed> a multiplayer clock with <left> seconds left is not low on time
      Given Alice is White and Bob is Black in a <time control> multiplayer game after e4 and e5
      When <passed> seconds pass in multiplayer chess
      Then both people see White's multiplayer clock is not low on time

      Examples:
        | speed     | time control | passed | left |
        | bullet    | 1+0          | 49     | 11   |
        | blitz     | 3+0          | 159    | 21   |
        | rapid     | 10+0         | 569    | 31   |
        | classical | 30+0         | 1739   | 61   |

  Rule: In a daily game a running multiplayer clock is low on time with 6 hours or less left at 1 day per move, and with 1 day or less left at 3 or 7 days per move
    No counter-example: nobody can make a multiplayer clock show otherwise than this rule says; the examples show a clock at that time and one hour above it.

    Scenario Outline: At <time control> per move a multiplayer clock with <left> left is <shown>
      Given Alice is White and Bob is Black in a daily game at <time control> per move after e4 and e5
      When <hours> hours pass in multiplayer chess
      Then both people see White's multiplayer clock is <shown>

      Examples:
        | time control | hours | left             | shown           |
        | 1 day        | 17    | 7 hours          | not low on time |
        | 1 day        | 18    | 6 hours          | low on time     |
        | 3 days       | 47    | 1 day and 1 hour | not low on time |
        | 3 days       | 48    | 1 day            | low on time     |
        | 7 days       | 143   | 1 day and 1 hour | not low on time |
        | 7 days       | 144   | 1 day            | low on time     |

  Rule: Both people and every watcher see a multiplayer clock that is low on time, and a person listening to the app hears it with the time left
    No counter-example: everyone who has the multiplayer game in front of them sees its multiplayer clocks, and nobody can hide one that is low on time from them.

    Scenario: A watcher sees a multiplayer clock that is low on time
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      When 50 seconds pass in multiplayer chess
      Then Carol sees White's multiplayer clock is low on time

    Scenario: A person listening to the app hears that a multiplayer clock is low on time and how much time is left
      Given Alice is listening to her 1+0 multiplayer game with Bob after e4 and e5
      When 50 seconds pass in multiplayer chess
      Then Alice hears White's multiplayer clock is low on time with 10 seconds left

  Rule: The person whose multiplayer clock it is hears the low on time warning once per game, when their clock first becomes low on time; nobody else hears it, nobody hears it with sounds turned off, and a daily game gives none

    Scenario: A person hears the low on time warning when their own multiplayer clock first becomes low on time
      Given Alice has turned sounds on
      And Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      When 50 seconds pass in multiplayer chess
      Then Alice hears the low on time warning

    Scenario: The multiplayer opponent and a watcher hear no low on time warning for someone else's multiplayer clock
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      And Bob has turned sounds on
      And Carol has turned sounds on
      When 50 seconds pass in multiplayer chess
      Then Bob hears no new low on time warning
      And Carol hears no new low on time warning

    Scenario: A person who has turned sounds off sees their multiplayer clock low on time without the low on time warning
      Given Alice has turned sounds off
      And Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      When 50 seconds pass in multiplayer chess
      Then Alice cannot hear the low on time warning while the app's sounds are off
      And both people see White's multiplayer clock is low on time

    Scenario: A daily game gives no low on time warning
      Given Alice has turned sounds on
      And Alice is White and Bob is Black in a daily game at 1 day per move after e4 and e5
      When 18 hours pass in multiplayer chess
      Then both people see White's multiplayer clock is low on time
      And Alice hears no new low on time warning

    Scenario: The low on time warning is not repeated when the multiplayer clock becomes low on time again
      Given Alice has turned sounds on
      And Alice's multiplayer clock was low on time earlier in her 2+1 multiplayer game with Bob, and she is White with 12 seconds left on her turn
      When 2 seconds pass in multiplayer chess
      Then both people see White's multiplayer clock is low on time
      And Alice hears no new low on time warning

  Rule: A multiplayer clock stops being low on time when an increment lifts it back above that time, and when the multiplayer game is over or aborted
    No counter-example: nobody can keep a multiplayer clock shown as low on time once it has more time again or has stopped.

    Scenario: An increment that lifts a bullet multiplayer clock back above 10 seconds shows it as not low on time again
      Given Alice is White and Bob is Black in a 2+1 multiplayer game after e4 and e5
      And 110 seconds have passed in multiplayer chess
      When Alice plays g1 to f3 as a multiplayer move
      Then both people see 11 seconds on White's multiplayer clock and 120 seconds on Black's
      And both people see White's multiplayer clock is not low on time

    Scenario: No multiplayer clock is low on time once the multiplayer game is over
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      And 50 seconds have passed in multiplayer chess
      When Bob resigns multiplayer chess
      Then both people see Alice won the multiplayer game
      And both people see White's multiplayer clock is not low on time

    Scenario: No multiplayer clock is low on time once the multiplayer game is aborted
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      And 2 days have passed in multiplayer chess
      When Bob aborts the multiplayer game
      Then both people see the multiplayer game was aborted
      And both people see White's multiplayer clock is not low on time
