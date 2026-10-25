@domain:light-cycles
Feature: Crash at the edge of the arena or on a trail
  When riders meet trouble, everyone wants every crash of a step decided at the same moment for every rider, so nobody survives a crash because their rider happened to be judged first.

  Background:
    Given Alice rides Comet, Bob rides Ember and Carol rides Nova in a Light Cycles Trio

  Rule: A rider whose step would take it outside the arena crashes

    Scenario Outline: A rider heading out of the arena crashes on the edge
      Given Comet is at column <column>, row <row> heading <direction>
      When the riders take their next step
      Then Comet has crashed and is still at column <column>, row <row>

      Examples:
        | column | row | direction |
        | 40     | 5   | right     |
        | 1      | 5   | left      |
        | 12     | 1   | up        |
        | 12     | 28  | down      |

    Scenario: A rider one cell from the edge rides onto the edge
      Given Comet is at column 39, row 5 heading right
      When the riders take their next step
      Then Comet is at column 40, row 5 heading right

  Rule: A rider whose step would land on any trail crashes

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario Outline: Landing on a riding rider's trail crashes the rider
      Given <rider>'s trail covers column 11, row 5
      When the riders take their next step
      Then Comet has crashed and is still at column 10, row 5

      Examples:
        | rider |
        | Comet |
        | Ember |

    Scenario: A crashed rider's trail still crashes another rider
      Given Nova has crashed with its trail covering column 11, row 5
      When the riders take their next step
      Then Comet has crashed and is still at column 10, row 5

    Scenario: A rider beside a trail rides on past it
      Given Ember's trail covers column 11, row 4
      When the riders take their next step
      Then Comet is at column 11, row 5 heading right

  Rule: Riders whose steps land on the same empty cell all crash

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario: Two riders heading into the same cell both crash
      Given Ember is at column 12, row 5 heading left
      When the riders take their next step
      Then Comet has crashed and is still at column 10, row 5
      And Ember has crashed and is still at column 12, row 5

    Scenario: Three riders heading into the same cell all crash
      Given Ember is at column 12, row 5 heading left
      And Nova is at column 11, row 6 heading up
      When the riders take their next step
      Then Comet, Ember and Nova have all crashed
      And the cell at column 11, row 5 is still empty

    Scenario: Riders heading into neighbouring cells both ride on
      Given Ember is at column 12, row 6 heading left
      When the riders take their next step
      Then Comet is at column 11, row 5 heading right
      And Ember is at column 11, row 6 heading left

  Rule: Two riders meeting head-on both crash

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario: Riders swapping cells head-on both crash
      Given Ember is at column 11, row 5 heading left
      When the riders take their next step
      Then Comet has crashed and is still at column 10, row 5
      And Ember has crashed and is still at column 11, row 5

    Scenario: Riders passing side by side both ride on
      Given Ember is at column 11, row 6 heading left
      When the riders take their next step
      Then Comet is at column 11, row 5 heading right
      And Ember is at column 10, row 6 heading left

  Rule: A crashed rider stops and its trail stays for the rest of the round
    No counter-example: nothing brings a crashed rider back before the next round.

    Scenario: The other riders ride on while a crashed rider stays where it crashed
      Given Ember has crashed at column 20, row 10
      When the riders take their next step
      Then Ember is still at column 20, row 10 with its trail on the arena
      And Comet and Nova are still riding
