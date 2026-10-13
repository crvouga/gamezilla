@domain:chess
Feature: One opponent search across a person's devices and spaces
  When a person is in more than one space from more than one device, they
  want one opponent search, so another device cannot start a second search
  or pull someone else's space into it.

  Rule: Another device in a different space does not start a second search

    Scenario: Finding an opponent from the other space is refused
      Given Alice is hosting a space and looking for a chess opponent
      And Alice's other device is in Bob's space
      When Alice finds a chess opponent for 5+0 on another device
      Then Alice is told she is already looking for a chess opponent
      And Bob is not looking for a chess opponent

    Scenario: The other device shows the same search
      Given Alice is hosting a space and looking for a chess opponent
      And Alice's other device is in Bob's space
      When Alice opens multiplayer chess on another device
      Then Alice is looking for her same chess opponent
      And Bob is not looking for a chess opponent

    Scenario: An offline device cannot start another search
      Given Alice is looking for a chess opponent and her phone is offline
      When Alice finds a chess opponent for 5+0 on her phone
      Then Alice is told multiplayer chess needs a connection
      And Alice is looking for her same chess opponent

  Rule: Two hosted spaces still share one game
    No counter-example: a second search is the previous rule.

    Scenario: Opening multiplayer chess on another device keeps the one game
      Given Alice and Bob have a multiplayer game in different spaces
      And Alice is also signed in on another device
      When Alice opens multiplayer chess on another device
      Then Alice keeps their same multiplayer game with Bob
      And Bob keeps their same multiplayer game with Alice
