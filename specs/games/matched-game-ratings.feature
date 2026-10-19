@domain:games
Feature: A rating for each speed
  When people play matched games, they want a rating for each speed that every finished matched game moves honestly, so they meet opponents of their own strength at the speed they chose.

  Rule: Each speed has its own rating, starting at 1500 with a "?" until it settles

    Scenario: A blitz rating loses its "?" once it settles
      Given Alice's blitz rating is one rated matched game from settling
      And Alice has the first side against Bob in a 3+2 matched game after their first moves
      When Bob resigns the matched game
      Then Alice sees her blitz rating without the "?"

    Scenario: A new account's blitz rating still shows the "?" after one result
      Given Alice and Bob have new accounts and a 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then Alice's blitz rating is still shown with the "?"

  Rule: Every finished matched game moves both people's rating for its speed exactly once

    Background:
      Given Alice and Bob have new accounts and a 5+0 matched game after their first moves

    Scenario: A victory between two new accounts raises one rating as much as it lowers the other
      When Bob resigns the matched game
      Then Alice sees her blitz rating rise above 1500
      And Bob sees his blitz rating fall below 1500 by the same amount

    Scenario: A matched game drawn by agreement between two new accounts leaves both at 1500
      Given Alice has offered Bob a draw in their matched game
      When Bob accepts the draw
      Then Alice's blitz rating is still 1500
      And Bob's blitz rating is still 1500

    Scenario: Resigning again counts the rated matched game only once
      Given Bob resigned the matched game and Alice won
      When Bob resigns the matched game
      Then Alice still has 1 rated matched game at blitz

  Rule: A result never moves the rating of another speed

    Scenario: A rapid matched game moves the rapid rating and leaves blitz alone
      Given Alice and Bob have new accounts and a 10+5 matched game after their first moves
      When Bob resigns the matched game
      Then Alice sees her rapid rating rise above 1500
      And Alice's blitz rating is still 1500

    Scenario: A blitz result cannot move a rapid rating
      Given Alice has a rapid rating of 1700
      And Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then Alice's rapid rating is still 1700

  Rule: Finding an opponent pairs people up by their rating for the chosen speed

    Scenario: Close blitz ratings get two 3+0 searches paired
      Given Alice has a blitz rating of 1800 and a rapid rating of 1200
      And Bob has a blitz rating of 1820
      And Alice and Bob are seeking an opponent for the game at 3+0
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides

    Scenario: Close rapid ratings alone do not get two 3+0 searches paired
      Given Alice has a blitz rating of 1200 and a rapid rating of 1800
      And Bob has a blitz rating of 1820
      And Alice and Bob are seeking an opponent for the game at 3+0
      When they are paired
      Then Alice and Bob are still waiting for other opponents
