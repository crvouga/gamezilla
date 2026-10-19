@domain:chess
Feature: Chess puzzles with the keyboard and by listening
  When someone uses the keyboard alone or listens to the app, they want to
  hear a chess puzzle's moves and pieces and play its moves by their squares,
  so chess puzzles remain available to them.

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

  Rule: Someone listening to the app hears the piece a hint picks
    No counter-example: a hint is never shown by colour alone.

    Scenario: Someone listening to the app hears which piece a hint picks
      Given Alice is signed in
      And Alice is listening to the app
      And Alice is solving the two-rook clearance puzzle
      When Alice asks for a hint
      Then Alice hears the hint names the rook on a1

  Rule: A puzzle can be solved with the keyboard alone
    No counter-example: the keyboard is a way to play the same moves; every move rule stays the same.

    Scenario: A solver solves a puzzle with the keyboard alone
      Given Alice has an account and is using the keyboard alone
      And Alice is solving the two-rook clearance puzzle
      And Alice has played a1-a5 with the keyboard
      When Alice plays the move h1-h5 with the keyboard
      Then Alice's puzzle is solved within 20 seconds
