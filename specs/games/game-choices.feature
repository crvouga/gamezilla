@domain:games
Feature: A game's choices
  When the host picks a game for a space, everyone in it wants the same choices for that game on every device, so the space plays it together whichever game it is.

  Rule: A game can offer playing a friend and playing a bot as separate choices
    No counter-example: what a game offers is the same for everyone in the space.

    Scenario: The host and guest see separate choices for playing a friend and playing a bot
      Given Alice is hosting a space that Bob joined from the link
      When Alice picks the game for the space
      Then Alice and Bob are offered separate choices to play a friend, play a bot, find an opponent and see game history

  Rule: Everyone in the space is shown the choice opened in it
    No counter-example: anyone in the space may open one of the game's choices, and it is shown to everyone.

    Scenario: Bob sees the table Alice opens for people
      Given Alice has picked the game for the space Bob joined
      When Alice opens the setup for playing a friend
      Then Bob is shown the setup for playing a friend within 15 seconds

    Scenario: Going back returns everyone to the game's choices
      Given Alice has opened the setup for playing a friend in the space Bob joined
      When Alice goes back to the game's choices
      Then Bob is shown the game's choices within 15 seconds
