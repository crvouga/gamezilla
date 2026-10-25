@domain:games
Feature: Choose a clock choice when finding an opponent
  When a person seeks an opponent, they want to choose how fast the matched game is played, so they only meet someone who wants the same clock choice.

  Rule: Seeking an opponent needs one of the offered clock choices

    Scenario: A person seeks an opponent at the clock choice they chose
      Given Alice has a free account and a connection
      When Alice seeks an opponent for the game at 3+2
      Then Alice is waiting for an opponent at 3+2

    Scenario: A clock choice that is not offered is refused
      Given Alice has a free account and a connection
      When Alice seeks an opponent for the game at 4+0
      Then Alice is told 4+0 is not an offered clock choice
      And Alice is not waiting for an opponent

    Scenario: A person already seeking cannot start a second search
      Given Alice is seeking an opponent for the game at 5+0
      When Alice seeks an opponent for the game at 3+2
      Then Alice is told she is already seeking an opponent
      And Alice is still waiting for an opponent at 5+0

  Rule: People are paired only with someone seeking the same clock choice

    Scenario: Two people seeking 5+0 get a 5+0 matched game
      Given Alice and Bob are seeking an opponent for the game at 5+0
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides
      And both people see their matched game is played at 5+0
      And the first side has the first turn

    Scenario: A 5+0 search is never paired with a 3+2 search
      Given Alice is seeking an opponent for the game at 5+0
      And Bob is seeking an opponent for the game at 3+2
      When they are paired
      Then Alice and Bob are still waiting for other opponents

  Rule: After a matched game is over, a person finds a new opponent at the same clock choice in one step

    Scenario: A new search keeps the clock choice of a matched game that is finished
      Given Alice's 5+0 matched game with Bob is finished
      When Alice finds a new opponent
      Then Alice is waiting for an opponent at 5+0

    Scenario: A new search keeps an aborted matched game's clock choice
      Given Alice's 3+2 matched game with Bob was aborted
      When Bob finds a new opponent
      Then Bob is waiting for an opponent at 3+2

    Scenario: A person already seeking cannot find a new opponent as well
      Given Alice's 5+0 matched game with Bob is finished
      And Alice is seeking an opponent for the game at 3+2
      When Alice finds a new opponent
      Then Alice is told she is already seeking an opponent
      And Alice is still waiting for an opponent at 3+2

    Scenario: A new opponent cannot be found during an unfinished matched game
      Given Alice has an unfinished matched game with Bob
      When Alice finds a new opponent
      Then Alice is told to finish her matched game first
      And Alice keeps her matched game with Bob

  Rule: A person waiting for an opponent sees their clock choice and how long they have been waiting
    No counter-example: every search shows its clock choice and how long it has run, so there is nothing to refuse.

    Scenario: A search shows its clock choice and how long it has run
      Given Alice is seeking an opponent for the game at 5+0
      When 40 seconds pass
      Then Alice sees she has been waiting for an opponent at 5+0 for 40 seconds

  Rule: A paired person sees their opponent's username and rating, the clock choice and their side

    Scenario: Each paired person sees who they play, how fast and on which side
      Given Bob has a blitz rating of 1620
      And Alice and Bob are seeking an opponent for the game at 3+2
      When they are paired
      Then Alice sees Bob as her opponent at 3+2, with a blitz rating of "1620" and her side
      And Bob sees Alice as his opponent at 3+2, with a blitz rating of "1500?" and his side

    Scenario: A person still waiting is shown no opponent
      Given Alice is the only person seeking an opponent for the game at 3+2
      When people are paired up
      Then Alice is still waiting for an opponent at 3+2
      And Alice is not shown an opponent
