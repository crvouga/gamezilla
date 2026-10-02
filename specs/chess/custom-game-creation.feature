@domain:chess
Feature: Create a Custom Game
  When people want a game of chess together, the host wants to choose White and Black, so a person or a bot fits the same Custom Game.

  Rule: Only the host creates the space's Custom Game

    Scenario: A guest creates a game without signing in
      Given Alice is a guest
      And Alice is hosting a space
      When Alice creates a Custom Game
      Then Alice is the creator of the Custom Game
      And White is Alice and Black is an open place in the Custom Game

    Scenario: A watcher cannot become the creator
      Given Alice is hosting a space that Bob joined from the link
      When Bob creates a Custom Game
      Then Bob is told only the host creates a Custom Game

  Rule: Creating another game keeps an unfinished game

    Scenario: A new game follows a cancelled game
      Given Alice has a cancelled Custom Game
      When Alice creates a Custom Game
      Then Alice has a configuring Custom Game with no moves

    Scenario: An active game cannot be replaced
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice creates a Custom Game
      Then Alice is told the Custom Game must finish or be cancelled first

  Rule: Every Custom Game starts with standard chess and is unrated
    No counter-example: Custom Games never change a puzzle rating and other starting positions are not offered.

    Scenario: A ready game starts from the usual position
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Alice starts the Custom Game
      Then The Custom Game is active with White to move
      And The Custom Game is unrated and untimed

    Scenario: A Custom Game cannot change the puzzle rating
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice resigns the Custom Game
      Then Bob wins the Custom Game by resignation
      And Alice's puzzle rating is 1500
