@domain:games
Feature: A clock that is low on time
  When a person's clock in a matched game is nearly used up, they want to see it shown as low on time and hear the low on time warning, so running out of time never takes them by surprise.

  Rule: A running clock is low on time once it has no more than 10 seconds left at bullet, 20 seconds at blitz, 30 seconds at rapid or 60 seconds at classical
    No counter-example: nobody can make a clock show otherwise than this rule says; the examples show a clock at that time and one second above it.

    Scenario Outline: At <speed> a clock with <left> seconds left is low on time
      Given Alice has the first side against Bob in a <clock choice> matched game after their first moves
      When <passed> seconds pass
      Then both people see the first side's clock is low on time

      Examples:
        | speed     | clock choice | passed | left |
        | bullet    | 1+0          | 50     | 10   |
        | blitz     | 3+0          | 160    | 20   |
        | rapid     | 10+0         | 570    | 30   |
        | classical | 30+0         | 1740   | 60   |

    Scenario Outline: At <speed> a clock with <left> seconds left is not low on time
      Given Alice has the first side against Bob in a <clock choice> matched game after their first moves
      When <passed> seconds pass
      Then both people see the first side's clock is not low on time

      Examples:
        | speed     | clock choice | passed | left |
        | bullet    | 1+0          | 49     | 11   |
        | blitz     | 3+0          | 159    | 21   |
        | rapid     | 10+0         | 569    | 31   |
        | classical | 30+0         | 1739   | 61   |

  Rule: In a daily game a running clock is low on time with 6 hours or less left at 1 day per move, and with 1 day or less left at 3 or 7 days per move
    No counter-example: nobody can make a clock show otherwise than this rule says; the examples show a clock at that time and one hour above it.

    Scenario Outline: At <clock choice> per move a clock with <left> left is <shown>
      Given Alice has the first side against Bob in a daily game at <clock choice> per move after their first moves
      When <hours> hours pass
      Then both people see the first side's clock is <shown>

      Examples:
        | clock choice | hours | left             | shown           |
        | 1 day        | 17    | 7 hours          | not low on time |
        | 1 day        | 18    | 6 hours          | low on time     |
        | 3 days       | 47    | 1 day and 1 hour | not low on time |
        | 3 days       | 48    | 1 day            | low on time     |
        | 7 days       | 143   | 1 day and 1 hour | not low on time |
        | 7 days       | 144   | 1 day            | low on time     |

  Rule: Both people and every watcher see a clock that is low on time, and a person listening to the app hears it with the time left
    No counter-example: everyone who has the matched game in front of them sees its clocks, and nobody can hide one that is low on time from them.

    Scenario: A watcher sees a clock that is low on time
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      When 50 seconds pass
      Then Carol sees the first side's clock is low on time

    Scenario: A person listening to the app hears that a clock is low on time and how much time is left
      Given Alice is listening to her 1+0 matched game with Bob after their first moves
      When 50 seconds pass
      Then Alice hears the first side's clock is low on time with 10 seconds left

  Rule: The person whose clock it is hears the low on time warning once per matched game, when their clock first becomes low on time; nobody else hears it, nobody hears it with sounds turned off, and a daily game gives none

    Scenario: A person hears the low on time warning when their own clock first becomes low on time
      Given Alice has turned sounds on
      And Alice has the first side against Bob in a 1+0 matched game after their first moves
      When 50 seconds pass
      Then Alice hears the low on time warning

    Scenario: The opponent and a watcher hear no low on time warning for someone else's clock
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      And Bob has turned sounds on
      And Carol has turned sounds on
      When 50 seconds pass
      Then Bob hears no new low on time warning
      And Carol hears no new low on time warning

    Scenario: A person who has turned sounds off sees their clock low on time without the low on time warning
      Given Alice has turned sounds off
      And Alice has the first side against Bob in a 1+0 matched game after their first moves
      When 50 seconds pass
      Then Alice cannot hear the low on time warning while the app's sounds are off
      And both people see the first side's clock is low on time

    Scenario: A daily game gives no low on time warning
      Given Alice has turned sounds on
      And Alice has the first side against Bob in a daily game at 1 day per move after their first moves
      When 18 hours pass
      Then both people see the first side's clock is low on time
      And Alice hears no new low on time warning

    Scenario: The low on time warning is not repeated when the clock becomes low on time again
      Given Alice has turned sounds on
      And Alice's clock was low on time earlier in her 2+1 matched game with Bob, and she has the first side with 12 seconds left on her turn
      When 2 seconds pass
      Then both people see the first side's clock is low on time
      And Alice hears no new low on time warning

  Rule: A clock stops being low on time when a move's added seconds lift it back above that time, and when the matched game is over
    No counter-example: nobody can keep a clock shown as low on time once it has more time again or has stopped.

    Scenario: A move's added seconds that lift a bullet clock back above 10 seconds show it as not low on time again
      Given Alice has the first side against Bob in a 2+1 matched game after their first moves
      And 110 seconds have passed
      When Alice makes her move
      Then both people see 11 seconds on the first side's clock and 120 seconds on the second side's
      And both people see the first side's clock is not low on time

    Scenario: No clock is low on time once the matched game is finished
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      And 50 seconds have passed
      When Bob resigns the matched game
      Then both people see Alice won the matched game
      And both people see the first side's clock is not low on time

    Scenario: No clock is low on time once the matched game is aborted
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And 2 days have passed
      When Bob aborts the matched game
      Then both people see the matched game was aborted
      And both people see the first side's clock is not low on time
