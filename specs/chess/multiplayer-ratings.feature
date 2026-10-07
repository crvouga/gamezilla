@domain:chess
Feature: Multiplayer ratings for each speed
  When people play multiplayer chess, they want a multiplayer rating for each
  speed that every finished multiplayer game moves honestly, so they meet
  chess opponents of their own strength at the speed they chose.

  Rule: Each speed has its own multiplayer rating, starting at 1500 with a "?" until it settles

    Scenario: A blitz rating loses its "?" once it settles
      Given Alice's blitz rating is one rated multiplayer game from settling
      And Alice is White and Bob is Black in a 3+2 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice sees her blitz rating without the "?"

    Scenario: A new account's blitz rating still shows the "?" after one multiplayer result
      Given Alice and Bob have new accounts and a 5+0 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice's blitz rating is still shown with the "?"

  Rule: Every finished multiplayer game moves both people's rating for its speed exactly once

    Background:
      Given Alice and Bob have new accounts and a 5+0 multiplayer game after e4 and e5

    Scenario: A multiplayer win between two new accounts raises one rating as much as it lowers the other
      When Bob resigns multiplayer chess
      Then Alice sees her blitz rating rise above 1500
      And Bob sees his blitz rating fall below 1500 by the same amount

    Scenario: A game drawn by agreement between two new accounts leaves both at 1500
      Given Alice has offered Bob a multiplayer draw
      When Bob accepts the multiplayer draw
      Then Alice's blitz rating is still 1500
      And Bob's blitz rating is still 1500

    Scenario: Resigning again counts the rated multiplayer game only once
      Given Bob resigned multiplayer chess and Alice won
      When Bob resigns multiplayer chess again
      Then Alice still has 1 rated multiplayer game at blitz

  Rule: A multiplayer result never moves the multiplayer rating of another speed

    Scenario: A rapid game moves the rapid rating and leaves blitz alone
      Given Alice and Bob have new accounts and a 10+5 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice sees her rapid rating rise above 1500
      And Alice's blitz rating is still 1500

    Scenario: A blitz multiplayer result cannot move a rapid rating
      Given Alice has a rapid rating of 1700
      And Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice's rapid rating is still 1700

  Rule: Matchmaking pairs people up by their multiplayer rating for the chosen speed

    Scenario: Close blitz ratings get two 3+0 searches matched
      Given Alice has a blitz rating of 1800 and a rapid rating of 1200
      And Bob has a blitz rating of 1820
      And Alice and Bob are looking for 3+0 chess opponents
      When matchmaking pairs people up
      Then Alice and Bob have the same multiplayer game

    Scenario: Close rapid ratings alone do not get two 3+0 searches matched
      Given Alice has a blitz rating of 1200 and a rapid rating of 1800
      And Bob has a blitz rating of 1820
      And Alice and Bob are looking for 3+0 chess opponents
      When matchmaking pairs people up
      Then Alice and Bob are still looking for other chess opponents
