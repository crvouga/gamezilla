@domain:games
Feature: Create a game session
  When people want to play the game together, the host wants to choose who plays each side, so a person or a bot fits the same game session.

  Rule: Only the host creates the space's game session

    @regression:chess-custom-client-schedules
    Scenario: A guest creates a game without signing in
      Given Alice is a guest
      And Alice is hosting a space
      When Alice creates a game session
      Then Alice is the creator of the game session
      And the first side is Alice and the second side is open

    Scenario: A watcher cannot become the creator
      Given Alice is hosting a space that Bob joined from the link
      When Bob creates a game session
      Then Bob is told only the host creates a game session

  Rule: Creating another game session keeps an unfinished one

    @regression:game-session-hidden-by-game-choice
    Scenario: Choosing another game brings the host back to unfinished setup
      Given Alice is setting up a game session
      When Alice opens game sessions for a different game
      Then Alice sees the game she was setting up with its seats unchanged

    Scenario: A new game follows a cancelled game
      Given Alice has a cancelled game session
      When Alice creates a game session
      Then a new game session is being set up with no moves

    Scenario: A game session under way cannot be replaced
      Given Alice and Bob have a game session under way
      When Alice creates a game session
      Then Alice is told the game session must finish or be cancelled first

  Rule: Every game session starts from the game's starting position and is unrated
    No counter-example: a game session never changes a rating, and other starting positions are not offered.

    Scenario: A ready game starts from the game's starting position
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Alice starts the game session
      Then the game session is under way from the game's starting position
      And the game session is unrated and untimed
