@domain:chess
Feature: Choosing the next puzzle
  When a solver moves on, they want a next puzzle that matches their puzzle
  rating and is worth playing, so every puzzle is a fair test of their skill.

  Rule: The feed never serves a low-quality puzzle: one with a popularity below 50, or played fewer than 5 times

    Background:
      Given Alice is signed in
      And Alice is hosting a space

    Scenario: A puzzle exactly at the quality bar is served
      Given the puzzle pool holds just one puzzle, with a popularity of 50, played 5 times
      When Alice opens puzzles in their space
      Then Alice has a puzzle on the board

    Scenario Outline: A puzzle below the quality bar is never served
      Given the puzzle pool holds just one puzzle, with a popularity of <popularity>, played <times> times
      When Alice opens puzzles in their space
      Then Alice is told the feed is empty within 15 seconds
      And Alice has no puzzle on the board

      Examples:
        | popularity | times |
        | 49         | 300   |
        | 90         | 4     |

  Rule: While an unplayed puzzle fits the rating window, the next puzzle comes from it: within 100 of the feed target for a settled rating, within 200 for a provisional one

    Background:
      Given Alice is signed in
      And the puzzle pool's unplayed puzzles are rated 1450, 1650 and 1900
      And Alice is hosting a space

    Scenario: A settled rating is served a puzzle within 100 of the feed target
      Given Alice's puzzle rating has settled at 1500
      When Alice opens puzzles in their space
      Then Alice is served a puzzle rated between 1400 and 1600

    Scenario: A settled rating is not offered a puzzle outside its rating window while one fits
      Given Alice's puzzle rating has settled at 1500
      When Alice opens puzzles in their space
      Then Alice is not offered the puzzle rated 1650

    Scenario: A provisional rating is served a puzzle within 200 of the feed target
      Given Alice is a new solver with a provisional 1500 puzzle rating
      When Alice opens puzzles in their space
      Then Alice is served a puzzle rated between 1300 and 1700

    Scenario: A provisional rating is not offered a puzzle outside its rating window while one fits
      Given Alice is a new solver with a provisional 1500 puzzle rating
      When Alice opens puzzles in their space
      Then Alice is not offered the puzzle rated 1900

  Rule: With no unplayed puzzle in the rating window, the unplayed puzzle nearest the feed target comes next

    Background:
      Given Alice is signed in
      And the puzzle pool's unplayed puzzles are rated 1650 and 1900
      And Alice's puzzle rating has settled at 1500
      And Alice is hosting a space

    Scenario: The nearest unplayed puzzle comes next when none fits the rating window
      When Alice opens puzzles in their space
      Then Alice is served the puzzle rated 1650

    Scenario: A far puzzle is not offered while a nearer unplayed one remains
      When Alice opens puzzles in their space
      Then Alice is not offered the puzzle rated 1900

  Rule: The next puzzle is chosen around the puzzle rating after the last result
    No counter-example: every rated result moves the feed target with the rating; the feed never keeps an earlier rating.

    Scenario: After a solve, the next puzzle fits the new puzzle rating
      Given Alice is signed in
      And Alice's puzzle rating has settled at 1500
      And Alice has solved the puzzle
      When Alice moves on to the next puzzle
      Then Alice is served a puzzle within 100 of their new puzzle rating

  Rule: A puzzle played on one of the solver's devices is not served on their other device

    Background:
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice has solved the puzzle

    Scenario: The other device serves a puzzle not yet played on either device
      When Alice opens puzzles on their other device
      Then Alice has a puzzle on the board

    @regression:puzzle-other-device-skips-finished
    Scenario: A puzzle solved on one device is not offered on the other
      When Alice opens puzzles on their other device
      Then Alice is not offered that puzzle on their other device
