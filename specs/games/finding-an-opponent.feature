@domain:games
Feature: Finding an opponent in every game
  When Alice wants another player, she wants an opponent for the game she chose at the same clock choice, so the pair can start playing together.

  Rule: Seeking an opponent needs an account and a connection

    Scenario: A free account can seek an opponent
      Given Alice has a free account and a connection
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    Scenario: A guest is invited to sign in
      Given Alice is a guest
      And Alice is hosting a space
      When Alice seeks an opponent for the game at 5+0
      Then Alice is invited to sign in
      And Alice is not waiting for an opponent

    Scenario: An offline account cannot seek an opponent
      Given Alice has an account without a connection
      When Alice seeks an opponent for the game at 5+0
      Then Alice is told finding an opponent needs a connection
      And Alice is not waiting for an opponent

  Rule: Paid access does not govern finding an opponent
    No counter-example: free accounts and Plus members seek an opponent alike, so paid access refuses nothing here.

    Scenario: A Plus member can seek an opponent
      Given Alice is a Plus member
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    Scenario: Losing paid access does not end a search
      Given Alice's paid access ended while she was seeking an opponent for the game at 5+0
      When Alice opens finding an opponent
      Then Alice is still waiting for an opponent at 5+0

  Rule: A person with an unfinished matched game cannot seek another opponent

    Scenario: A person may seek an opponent again once their matched game is finished
      Given Alice's 5+0 matched game with Bob is finished
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    Scenario: Another device cannot seek a second unfinished matched game
      Given Alice has an unfinished matched game with Bob
      When Alice seeks an opponent for the game at 5+0 on another device
      Then Alice is told to finish her matched game first
      And Alice keeps her matched game with Bob

  Rule: People are paired only for the same game at the same clock choice

    Scenario: Compatible people receive one new game on opposite sides
      Given Alice and Bob are seeking an opponent for the game at the same clock choice
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides
      And the first side has the first turn

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
