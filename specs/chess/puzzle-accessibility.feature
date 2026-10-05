@domain:chess
Feature: Puzzles with the keyboard and by listening
  When someone uses the keyboard alone or listens to the app, they want to
  follow and solve a puzzle, so puzzles remain available to them.

  Rule: Someone listening to the app hears the setup move, which side is to move, and each opponent reply
    No counter-example: what the board shows is always also heard by someone listening to the app.

    Background:
      Given Alice is signed in
      And Alice is listening to the app

    Scenario: Opening a puzzle tells someone listening to the app the setup move and which side is to move
      When Alice opens the two-rook clearance puzzle
      Then Alice hears the setup move a7-a6
      And Alice hears that White is to move

    Scenario: Someone listening to the app hears the opponent's reply
      Given Alice is solving the two-rook clearance puzzle
      When Alice plays the move a1-a5
      Then Alice hears the opponent's reply h7-h6

  Rule: Someone listening to the app hears each result: a wrong move, a solve, the piece a hint picks, and the rating change
    No counter-example: every result the board shows is also heard; a hint is never shown by colour alone.

    Background:
      Given Alice is signed in
      And Alice is listening to the app

    Scenario: Someone listening to the app hears in words that a move was wrong
      Given Alice is solving the castling puzzle
      When Alice plays a wrong move
      Then Alice hears in words that the move was wrong

    Scenario: Someone listening to the app hears that the puzzle is solved
      Given Alice is solving the two-rook clearance puzzle
      And Alice has played a1-a5
      When Alice plays the move h1-h5
      Then Alice hears the puzzle is solved

    Scenario: Someone listening to the app hears which piece a hint picks
      Given Alice is solving the two-rook clearance puzzle
      When Alice asks for a hint
      Then Alice hears the hint names the rook on a1

    Scenario: Someone listening to the app hears the rating change
      Given Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice hears their rating change

  Rule: A puzzle can be solved with the keyboard alone
    No counter-example: the keyboard is a way to play the same moves; every move rule stays the same.

    Scenario: A solver solves a puzzle with the keyboard alone
      Given Alice has an account and is using the keyboard alone
      And Alice is solving the two-rook clearance puzzle
      And Alice has played a1-a5 with the keyboard
      When Alice plays the move h1-h5 with the keyboard
      Then Alice's puzzle is solved within 20 seconds

  Rule: Retry, hint, show the solution, skip and move on all work with the keyboard alone
    No counter-example: the keyboard is a way to perform the same choices; every refusal stays the same.

    Background:
      Given Alice has an account and is using the keyboard alone
      And Alice is playing puzzles in their space

    Scenario: A hint works with the keyboard alone
      When Alice asks for a hint with the keyboard
      Then Alice's hint highlights the piece to move

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
