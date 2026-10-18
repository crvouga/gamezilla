@domain:games
Feature: Every device in a space follows the host
  When a host chooses what the space plays, everyone in the space wants
  every device they have there to show that choice, so the space follows
  its host and a guest cannot take it somewhere else.

  Rule: The host's choice is what every device in the space shows

    Scenario: The host picks the game and everyone in the space is taken to it
      Given Alice is hosting a space that Bob joined from the link
      When Alice picks the game for the space
      Then Bob is shown the game's choices within 15 seconds

    Scenario: The host's other device chooses the game and every device is taken there
      Given Alice is hosting a space that Bob joined from the link
      And Alice's other device is in the space
      When Alice picks the game for the space on her other device
      Then Bob is shown the game's choices within 15 seconds
      And Alice's phone and her other device are shown the game's choices within 15 seconds

    Scenario: A guest cannot choose the game
      Given Alice is hosting a space that Bob joined from the link
      When Bob picks the game for the space
      Then Bob is told only the host chooses the game
      And Bob sees the space's game choice

    Scenario: An offline device cannot choose the game
      Given Alice is hosting a space that Bob joined from the link
      And Alice's phone is offline
      When Alice picks the game for the space on her phone
      Then Alice is told the connection is missing within 15 seconds
      And Bob sees the space's game choice

    Scenario: A device whose connection comes back shows the host's game
      Given Alice's other device has picked the game for the space Bob joined
      And Alice's phone is offline
      When the connection comes back
      Then Alice's phone is shown the game's choices within 15 seconds

    Scenario: Picking the game again is not offered once everyone is there
      Given Alice is hosting a space that Bob joined from the link
      And Alice has picked the game for the space
      When Alice picks the game for the space
      Then Alice is not offered to pick the game for the space
      And Bob is shown the game's choices within 15 seconds

  Rule: A later choice by the host replaces the earlier one on every device

    Scenario: Going back to the game choice replaces the game on every device
      Given Alice is hosting a space that Bob joined from the link
      And Alice has picked the game for the space from her other device
      When Alice goes back from the game's choices to the game choice
      Then Bob sees the space's game choice
      And Alice's phone and her other device see the space's game choice

    Scenario: A guest cannot leave the host's game
      Given Alice is hosting a space that Bob joined from the link
      And Alice has picked the game for the space
      When Bob goes back from the game's choices to the game choice
      Then Bob is told only the host chooses the game
      And Bob is shown the game's choices within 15 seconds

    Scenario: Going back is not offered while the space is on the game choice
      Given Alice is hosting a space that Bob joined from the link
      When Alice goes back from the game's choices to the game choice
      Then Alice is not offered to go back to the game choice
      And Alice sees the space's game choice

    Scenario: An offline device cannot replace the host's game
      Given Alice has picked the game for the space Bob joined and her phone is offline
      When Alice goes back from the game's choices to the game choice on her phone
      Then Alice is told the connection is missing within 15 seconds
      And Bob is shown the game's choices within 15 seconds

  Rule: Being idle leaves everyone on the host's last choice
    No counter-example: idle never chooses a game, and nobody is told the host is offline.

    Scenario: An idle host leaves everyone on the game
      Given Alice is hosting a space that Bob joined from the link
      And Alice has picked the game for the space
      When Alice stays idle for 2 minutes
      Then Bob sees Alice is idle within 20 seconds
      And Bob is shown the game's choices within 15 seconds
