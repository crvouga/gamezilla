@domain:games
Feature: Finding an opponent in every game
  When Alice wants another player, she wants an opponent for the game she chose, so the pair can start playing together.

  Rule: Seeking an opponent needs an account and a connection

    Scenario: A free account can seek an opponent
      Given Alice has a free account and a connection
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

    Scenario: A guest is invited to sign in
      Given Alice is a guest
      And Alice is hosting a space
      When Alice seeks an opponent for the game
      Then Alice is invited to sign in
      And Alice is not waiting for an opponent

    Scenario: An offline account cannot seek an opponent
      Given Alice has an account without a connection
      When Alice seeks an opponent for the game
      Then Alice is told finding an opponent needs a connection
      And Alice is not waiting for an opponent

  Rule: Paid access does not govern finding an opponent
    No counter-example: free accounts and Plus members seek an opponent alike, so paid access refuses nothing here.

    Scenario: A Plus member can seek an opponent
      Given Alice is a Plus member
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

    Scenario: Losing paid access does not end a search
      Given Alice's paid access ended while she was seeking an opponent for the game
      When Alice opens finding an opponent
      Then Alice is still waiting with her same search

  Rule: A person with an unfinished matched game cannot seek another opponent

    Scenario: A person may seek an opponent again once their matched game is finished
      Given Alice's matched game with Bob is finished
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

    Scenario: Another device cannot seek a second unfinished matched game
      Given Alice has an unfinished matched game with Bob
      When Alice seeks an opponent for the game on another device
      Then Alice is told to finish her matched game first
      And Alice keeps her matched game with Bob

  Rule: People are paired only for the same game

    Scenario: Compatible people receive one new game on opposite sides
      Given Alice and Bob are seeking an opponent for the game
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides

    Scenario: Someone seeking another game is never paired for this one
      Given Alice seeks an opponent for the game and Bob seeks an opponent for another game
      When they are paired
      Then Alice and Bob are not paired together

  Rule: One pairing gives its two people one matched game
    No counter-example: opening finding an opponent again never pairs anyone again or starts another matched game.

    Scenario: Opening finding an opponent again keeps the same matched game
      Given Alice has an unfinished matched game with Bob
      When Alice opens finding an opponent
      Then Alice and Bob keep the same matched game and board

  Rule: Someone who stops seeking is no longer waiting, and a search that became a matched game has nothing to stop

    Scenario: Alice is no longer waiting once she stops seeking
      Given Alice is seeking an opponent for the game
      When Alice stops seeking an opponent
      Then Alice is no longer waiting for an opponent

    Scenario: A person cannot stop a search that already became a matched game
      Given Alice has an unfinished matched game with Bob
      When Alice stops seeking an opponent
      Then Alice is told she has no search to stop
      And Alice keeps her matched game with Bob

    Scenario: A person with no search is told there is nothing to stop
      Given Alice has a free account and a connection
      When Alice stops seeking an opponent
      Then Alice is told she has no search to stop
      And Alice is not waiting for an opponent

    Scenario: An offline person keeps the search she cannot stop
      Given Alice is seeking an opponent for the game
      And Alice is offline
      When Alice stops seeking an opponent
      Then Alice is told finding an opponent needs a connection
      And Alice is still waiting with her same search
