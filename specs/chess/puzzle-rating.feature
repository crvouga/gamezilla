@domain:chess
Feature: Puzzle rating
  When a solver plays puzzles, they want a running puzzle rating that moves
  after every rated puzzle, online or offline, so they can see how they are
  doing. A new solver starts at 1500 with a "?" until the rating settles.
  Every device shows the same rating, and a puzzle moves it at most once,
  ever. A wrong move earns half credit, just like a hint.

  Rule: The first rated attempt moves the puzzle rating once and every device shows that rating

    Scenario: The "?" goes once the rating settles
      Given Alice is signed in
      And Alice's puzzle rating is one rated puzzle from settling
      And Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice's stats show their rating without the "?"

    Scenario: A puzzle solved offline raises the rating at once
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice is offline
      When Alice solves the puzzle
      Then Alice's puzzle rating is above 1500

    Scenario: A puzzle solved offline counts once, on every device
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice is playing puzzles in their space
      And Alice has solved a puzzle while offline
      When the connection comes back
      Then both of Alice's devices show the same puzzle rating within 30 seconds
      And Alice's stats show 1 played, 1 solved, and 100% accuracy

    Scenario: A repeat of a played puzzle moves neither the rating nor the stats
      Given the puzzle pool holds just three puzzles
      And Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has solved 3 puzzles in a row
      And Alice's feed has come round to a puzzle they already played
      When Alice solves the puzzle
      Then Alice's puzzle rating is unchanged by the repeat
      And Alice's stats show 3 played, 3 solved, and 100% accuracy

    Scenario: A second device shows the rating earned on the first
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has solved 2 puzzles in a row
      When Alice's account opens on another device
      Then Alice's other device shows the same puzzle rating within 30 seconds

    @regression:puzzle-wrong-move-half-credit
    Scenario: A wrong move costs the same as a hint
      Given Alice and Bob are signed in
      And Alice is solving the hook-mate puzzle
      And Bob is solving the hook-mate puzzle
      And Bob has taken a hint
      When Alice plays a wrong move
      And Bob solves the puzzle
      Then Alice's puzzle rating is below 1500
      And Bob's puzzle rating is the same as Alice's
