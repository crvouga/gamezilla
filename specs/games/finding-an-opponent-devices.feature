@domain:games
Feature: One search and one matched game across a person's devices and spaces
  When a person uses more than one device or space, they want one search and one matched game, so another device never starts a second search or pulls someone else's space into it.

  Rule: A person's search and matched game follow them to every device
    No counter-example: another device shows the person's search or matched game; opening it starts neither.

    Scenario: Another device shows the person's search
      Given Alice is seeking an opponent for the game
      When Alice opens finding an opponent on another device
      Then Alice sees her same search on that device

    Scenario: Opening finding an opponent on another device does not start a new matched game
      Given Alice has an unfinished matched game with Bob
      When Alice opens finding an opponent on another device
      Then Alice sees the same matched game and board on that device

  Rule: Another device in a different space does not start a second search

    Background:
      Given Alice is hosting a space and seeking an opponent for the game

    Scenario: Seeking an opponent from the other space is refused
      Given Alice's other device is in Bob's space
      When Alice seeks an opponent for the game on another device
      Then Alice is told she is already seeking an opponent
      And Bob is not waiting for an opponent

    Scenario: The other device shows the same search
      Given Alice's other device is in Bob's space
      When Alice opens finding an opponent on another device
      Then Alice is still waiting with her same search
      And Bob is not waiting for an opponent

    Scenario: An offline device cannot start another search
      Given Alice is offline
      When Alice seeks an opponent for the game
      Then Alice is told finding an opponent needs a connection
      And Alice is still waiting with her same search

  Rule: Two hosted spaces still share one matched game
    No counter-example: a second search is the previous rule.

    Scenario: Opening finding an opponent on another device keeps the one matched game
      Given Alice and Bob have a matched game in different spaces
      And Alice is also signed in on another device
      When Alice opens finding an opponent on another device
      Then Alice keeps her matched game with Bob
      And Bob keeps his matched game with Alice
