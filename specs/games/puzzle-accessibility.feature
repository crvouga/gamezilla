@domain:games
Feature: Puzzles with the keyboard and by listening
  When someone uses the keyboard alone or listens to the app, they want to
  follow a puzzle of the game and use every choice around it, so puzzles
  remain available to them.

  Rule: Someone listening to the app hears each result: a wrong move, a solve and the rating change
    No counter-example: every result the board shows is also heard.

    Background:
      Given Alice is signed in
      And Alice is listening to the app

    Scenario: Someone listening to the app hears in words that a move was wrong
      Given Alice is solving the game's known puzzle
      When Alice plays a wrong move
      Then Alice hears in words that the move was wrong

    Scenario: Someone listening to the app hears that the puzzle is solved
      Given Alice is solving the game's known puzzle
      And Alice has played the next move of the solution
      When Alice plays the last move of the solution
      Then Alice hears the puzzle is solved

    Scenario: Someone listening to the app hears the rating change
      Given Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice hears their rating change

  Rule: Retry, hint, show the solution, skip and move on all work with the keyboard alone
    No counter-example: the keyboard is a way to perform the same choices; every refusal stays the same.

    Background:
      Given Alice has an account and is using the keyboard alone
      And Alice is playing puzzles in their space

    Scenario: A hint works with the keyboard alone
      When Alice asks for a hint with the keyboard
      Then Alice's hint highlights where the solution move starts

    Scenario: Retrying works with the keyboard alone
      Given Alice has played a wrong move
      When Alice retries the puzzle with the keyboard
      Then Alice is still asked to find the next move

    Scenario: Showing the solution works with the keyboard alone
      When Alice shows the solution with the keyboard
      Then Alice's puzzle shows the revealed solution within 20 seconds

    Scenario: Skipping works with the keyboard alone
      When Alice skips the puzzle with the keyboard
      Then Alice's puzzle is skipped

    Scenario: Moving on works with the keyboard alone
      Given Alice has solved the puzzle
      When Alice moves on to the next puzzle with the keyboard
      Then Alice is solving a different puzzle than the one before
