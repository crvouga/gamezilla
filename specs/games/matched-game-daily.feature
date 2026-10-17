@domain:games
Feature: Daily games
  When a person cannot sit through a whole matched game at once, they want a daily game with days for every move, so they can play it one move at a time across days.

  Rule: Finding an opponent offers three daily clock choices: 1 day, 3 days and 7 days per move

    Background:
      Given Alice has a free account and a connection

    Scenario: A person seeks an opponent at the shortest daily clock choice
      When Alice seeks an opponent for the game at 1 day per move
      Then Alice is waiting for an opponent at 1 day per move

    Scenario: A person seeks an opponent at the longest daily clock choice
      When Alice seeks an opponent for the game at 7 days per move
      Then Alice is waiting for an opponent at 7 days per move

    Scenario: A daily clock choice that is not offered is refused
      When Alice seeks an opponent for the game at 8 days per move
      Then Alice is told 8 days per move is not an offered clock choice
      And Alice is not waiting for an opponent

  Rule: People are paired only with someone seeking the same daily clock choice

    Scenario: Two people seeking 3 days per move get a daily game at 3 days per move
      Given Alice and Bob are seeking an opponent for the game at 3 days per move
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides
      And both people see their matched game is played at 3 days per move

    Scenario: A search for 3 days per move is never paired with a search for 7 days per move
      Given Alice is seeking an opponent for the game at 3 days per move
      And Bob is seeking an opponent for the game at 7 days per move
      When they are paired
      Then Alice and Bob are still waiting for other opponents

  Rule: Daily is a speed of its own, with a daily rating that starts at 1500 with a "?"

    Scenario: A paired person sees their opponent's daily rating
      Given Alice and Bob are seeking an opponent for the game at 3 days per move
      When they are paired
      Then Alice sees Bob as her opponent at 3 days per move, with a daily rating of "1500?" and her side

    Scenario: A finished daily game moves the daily rating and leaves the blitz rating alone
      Given Alice and Bob have new accounts and a daily game at 3 days per move after their first moves
      When Bob resigns the matched game
      Then Alice sees her daily rating rise above 1500
      And Alice's blitz rating is still 1500

    Scenario: A blitz result cannot move a daily rating
      Given Alice has a daily rating of 1700
      And Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then Alice's daily rating is still 1700

  Rule: A daily game lasts across days: leaving or ending a space, closing the app or using another device never ends or pauses it

    Background:
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves

    Scenario: A person who comes back a day later finds their daily game and the time they have left
      Given Alice closed the app 1 day ago
      When Alice opens finding an opponent
      Then Alice keeps her matched game with Bob
      And both people see 2 days on the first side's clock and 3 days on the second side's

    Scenario: Ending the space keeps the daily game
      Given Alice has ended the space
      And Alice is hosting another space
      When Alice opens finding an opponent
      Then Alice keeps her matched game with Bob

    Scenario: Another device shows the same daily game
      When Alice opens finding an opponent on another device
      Then Alice sees the same matched game and board on that device

    Scenario: A closed app with time left does not end the daily game
      Given Alice has closed the app
      When 2 days pass
      Then the matched game is still unfinished

    Scenario: A closed app does not pause the clock
      Given Alice has closed the app
      When 3 days pass
      Then Bob sees he won the matched game on time
