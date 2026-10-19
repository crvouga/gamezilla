@domain:games
Feature: Create a custom game
  When people want to play the game together, the host wants to choose who plays each side, so a person or a bot fits the same custom game.

  Rule: Only the host creates the space's custom game

    @regression:chess-custom-client-schedules
    Scenario: A guest creates a game without signing in
      Given Alice is a guest
      And Alice is hosting a space
      When Alice creates a custom game
      Then Alice is the creator of the custom game
      And the first side is Alice and the second side is open

    Scenario: A watcher cannot become the creator
      Given Alice is hosting a space that Bob joined from the link
      When Bob creates a custom game
      Then Bob is told only the host creates a custom game

  Rule: Creating another custom game keeps an unfinished one

    Scenario: A new game follows a cancelled game
      Given Alice has a cancelled custom game
      When Alice creates a custom game
      Then a new custom game is being set up with no moves

    Scenario: A custom game under way cannot be replaced
      Given Alice and Bob have a custom game under way
      When Alice creates a custom game
      Then Alice is told the custom game must finish or be cancelled first

  Rule: Every custom game starts from the game's starting position and is unrated
    No counter-example: a custom game never changes a rating, and other starting positions are not offered.

    Scenario: A ready game starts from the game's starting position
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Alice starts the custom game
      Then the custom game is under way from the game's starting position
      And the custom game is unrated and untimed
