@domain:games
Feature: A game's choices
  When the host picks a game for a space, everyone in it wants the same choices for that game on every device, so the space plays it together whichever game it is.

  Rule: Every game offers custom games, finding an opponent and its history
    No counter-example: what a game offers is the same for everyone in the space.

    Scenario: The host's game offers its custom games, finding an opponent and its history
      Given Alice is hosting a space that Bob joined from the link
      When Alice picks the game for the space
      Then Alice and Bob are offered the game's custom games, finding an opponent and its history

  Rule: Everyone in the space is shown the choice opened in it
    No counter-example: anyone in the space may open one of the game's choices, and it is shown to everyone.

    Scenario: Bob is shown the custom games Alice opens
      Given Alice has picked the game for the space Bob joined
      When Alice opens the game's custom games
      Then Bob is shown the game's custom games within 15 seconds

    Scenario: Going back returns everyone to the game's choices
      Given Alice has opened the game's custom games in the space Bob joined
      When Alice goes back to the game's choices
      Then Bob is shown the game's choices within 15 seconds
