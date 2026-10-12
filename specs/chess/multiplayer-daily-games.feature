@domain:chess
Feature: Daily games in multiplayer chess
  When a person cannot sit through a whole game at once, they want a
  daily game with days for every move, so they can play multiplayer chess
  one move at a time across days.

  Rule: Finding a chess opponent offers three daily time controls: 1 day, 3 days and 7 days per move

    Background:
      Given Alice has a free account and a connection

    Scenario: A person looks for a chess opponent at the shortest daily time control
      When Alice finds a chess opponent for 1 day per move
      Then Alice is looking for a 1 day per move chess opponent

    Scenario: A person looks for a chess opponent at the longest daily time control
      When Alice finds a chess opponent for 7 days per move
      Then Alice is looking for a 7 days per move chess opponent

    Scenario: A daily time control that is not offered is refused
      When Alice finds a chess opponent for 8 days per move
      Then Alice is told 8 days per move is not an offered time control
      And Alice is not looking for a chess opponent

  Rule: People are matched only with someone looking for the same daily time control

    Scenario: Two people looking for 3 days per move get a daily game at 3 days per move
      Given Alice and Bob are looking for 3 days per move chess opponents
      When matchmaking pairs people up
      Then Alice and Bob have the same multiplayer game
      And both people see their multiplayer game is played at 3 days per move

    Scenario: A search for 3 days per move is never matched with a search for 7 days per move
      Given Alice is looking for a 3 days per move chess opponent
      And Bob is looking for a 7 days per move chess opponent
      When matchmaking pairs people up
      Then Alice and Bob are still looking for other chess opponents

  Rule: Daily is a speed of its own, with a daily rating that starts at 1500 with a "?"

    Scenario: A matched person sees their multiplayer opponent's daily rating
      Given Alice and Bob are looking for 3 days per move chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then Alice sees Bob as their multiplayer opponent at 3 days per move, with a daily rating of "1500?" and their colour

    Scenario: A finished daily game moves the daily rating and leaves the blitz rating alone
      Given Alice and Bob have new accounts and a daily game at 3 days per move after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice sees her daily rating rise above 1500
      And Alice's blitz rating is still 1500

    Scenario: A blitz multiplayer result cannot move a daily rating
      Given Alice has a daily rating of 1700
      And Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice's daily rating is still 1700

  Rule: A daily game lasts across days: leaving or ending a space, closing the app or using another device never ends or pauses it

    Background:
      Given Alice is White and Bob is Black in a daily game at 3 days per move after e4 and e5

    Scenario: A person who comes back a day later finds their daily game and the time they have left
      Given Alice closed the app 1 day ago
      When Alice opens multiplayer chess
      Then Alice keeps their same multiplayer game with Bob
      And both people see 2 days on White's multiplayer clock and 3 days on Black's

    Scenario: Ending the space keeps the daily game
      Given Alice has ended the space
      And Alice is hosting another space
      When Alice opens multiplayer chess
      Then Alice keeps their same multiplayer game with Bob

    Scenario: Another device shows the same daily game
      When Alice opens multiplayer chess on another device
      Then Alice sees the same multiplayer game and board on that device

    Scenario: A closed app with time left does not end the daily game
      Given Alice has closed the app
      When 2 days pass in multiplayer chess
      Then the multiplayer game is still unfinished

    Scenario: A closed app does not pause the multiplayer clock
      Given Alice has closed the app
      When 3 days pass in multiplayer chess
      Then Bob sees he won the multiplayer game because White ran out of time
