@domain:chess
Feature: A grounded Puzzle Assistant
  When a solver works through a puzzle, they want a useful observation they
  can trust, so the Puzzle Assistant explains the board rather than guessing.

  Rule: The assistant acknowledges what actually happened

    Scenario: A correct continuation receives encouragement
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      When Alice plays the move a1-a5
      Then Alice's assistant acknowledges a correct continuation

    Scenario: An alternate checkmate receives success commentary
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      When Alice plays the move a7-a8
      Then Alice's assistant acknowledges checkmate
      And Alice's assistant cannot call the move wrong

    Scenario: A wrong move receives a diagnosis rather than praise
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      When Alice plays the move a7-a6
      Then Alice's assistant draws attention to an available checkmate
      And Alice's assistant cannot praise a solved puzzle

  Rule: Specific observations require proof from the position

    Scenario: The assistant identifies a hanging knight after a wrong move
      Given Alice is signed in
      And Alice is solving the puzzle with an exposed knight
      When Alice plays a wrong move exposing the knight
      Then Alice's assistant explains that the knight could be captured without a recapture

    Scenario: A defended knight is not described as hanging
      Given Alice is signed in
      And Alice is solving the puzzle with a defended knight
      When Alice plays the quiet wrong move
      Then Alice's assistant cannot claim a hanging knight

    Scenario: A wrong move allowing a knight fork identifies its targets
      Given Alice is signed in
      And Alice is solving the puzzle with a knight fork threat
      When Alice plays the quiet wrong move
      Then Alice's assistant explains the knight fork of king and queen

    Scenario: Puzzle labels cannot invent a fork
      Given Alice is signed in
      And Alice is solving the castling puzzle labelled as a fork
      When Alice plays a wrong move
      Then Alice's assistant cannot claim a fork

  Rule: The assistant gives one most useful observation
    No counter-example: the assistant never offers several competing diagnoses.

    Scenario: Check takes priority over a tactical opportunity
      Given Alice is signed in
      And Alice's puzzle starts in check with a hanging piece
      When Alice opens that puzzle
      Then Alice's assistant explains that the king must escape check

    Scenario: Missing checkmate takes priority over a hanging piece
      Given Alice is signed in
      And Alice's puzzle offers checkmate and a wrong move exposes a knight
      When Alice plays the quiet wrong move
      Then Alice's assistant draws attention to an available checkmate

  Rule: Help never changes the attempt's first result

    Scenario: Taking a hint explains the offered help
      Given Alice is signed in
      And Alice is playing puzzles in their space
      When Alice asks for a hint
      Then Alice's assistant explains the highlighted solution piece

    Scenario: Showing the solution is never praised as a clean solve
      Given Alice is signed in
      And Alice is playing puzzles in their space
      When Alice shows the solution
      Then Alice's assistant explains that the solution is shown
      And Alice's assistant cannot praise a solved puzzle
