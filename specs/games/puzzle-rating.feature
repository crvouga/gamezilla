@domain:games
Feature: Puzzle rating
  When a solver plays puzzles of the game, they want a running puzzle rating
  at that game's puzzles that moves fairly after every rated puzzle, online
  or offline, so it honestly shows their skill and the feed can choose
  puzzles that fit it.

  Rule: The first rated attempt moves the puzzle rating once and every device shows that rating

    Scenario: The "?" goes once the puzzle rating settles
      Given Alice is signed in
      And Alice's puzzle rating is one rated puzzle from settling
      And Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice's stats show their puzzle rating without the "?"

    Scenario: A puzzle solved offline raises the puzzle rating at once
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

    Scenario: A repeat of a played puzzle moves neither the puzzle rating nor the stats
      Given the puzzle pool holds just three puzzles
      And Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has solved 3 puzzles in a row
      And Alice's feed has come round to a puzzle they already played
      When Alice solves the puzzle
      Then Alice's puzzle rating is still unchanged by the repeat because that puzzle is already rated
      And Alice's stats show 3 played, 3 solved, and 100% accuracy

    Scenario: A second device shows the puzzle rating earned on the first
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has solved 2 puzzles in a row
      When Alice's account opens on another device
      Then Alice's other device shows the same puzzle rating within 30 seconds

  Rule: Solving a harder puzzle gains more than solving an easier one, and failing an easier puzzle costs more than failing a harder one
    No counter-example: every rated result moves the puzzle rating by how hard the puzzle was for the solver; nothing a solver does opts out of it.

    Background:
      Given Alice and Bob are signed in
      And Alice's puzzle rating has settled at 1500
      And Bob's puzzle rating has settled at 1500

    Scenario: Solving a puzzle rated 1700 gains more than solving one rated 1300
      Given Bob has solved a puzzle rated 1300
      And Alice is solving a puzzle rated 1700
      When Alice solves the puzzle
      Then Alice's puzzle rating is above Bob's

    Scenario: Failing a puzzle rated 1300 costs more than failing one rated 1700
      Given Bob has played a wrong move on a puzzle rated 1700
      And Alice is solving a puzzle rated 1300
      When Alice plays a wrong move
      Then Alice's puzzle rating is below Bob's

  Rule: A provisional puzzle rating moves further for each puzzle than a settled one
    No counter-example: every new solver starts provisional and settles by playing; nothing a solver does changes how far it moves.

    Scenario: A provisional puzzle rating gains more from a solve than a settled one
      Given Alice is a new solver with a provisional 1500 puzzle rating
      And Bob's puzzle rating has settled at 1500
      And Bob has solved the game's known puzzle
      And Alice is solving the game's known puzzle
      When Alice solves the puzzle
      Then Alice's puzzle rating is above Bob's

  Rule: The puzzle rating never goes below the rating floor of 400 or above the rating ceiling of 3000

    Background:
      Given Alice is signed in

    Scenario: Solving at the rating floor raises the puzzle rating
      Given Alice's puzzle rating has settled at 400
      And Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice's puzzle rating is above 400

    Scenario: Failing at the rating floor leaves the puzzle rating at 400
      Given Alice's puzzle rating has settled at 400
      And Alice is playing puzzles in their space
      When Alice plays a wrong move
      Then Alice's puzzle rating cannot go below 400

    Scenario: Failing at the rating ceiling lowers the puzzle rating
      Given Alice's puzzle rating has settled at 3000
      And Alice is playing puzzles in their space
      When Alice plays a wrong move
      Then Alice's puzzle rating is below 3000

    Scenario: Solving at the rating ceiling leaves the puzzle rating at 3000
      Given Alice's puzzle rating has settled at 3000
      And Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice's puzzle rating cannot go above 3000

  Rule: A solve after a hint earns half credit: the same as a wrong move, and less than a clean solve
    No counter-example: a hint is always available while solving, and a solve after one always earns half credit.

    Background:
      Given Alice and Bob are signed in

    @regression:puzzle-wrong-move-half-credit
    Scenario: A wrong move costs the same as a hint
      Given Alice is solving the game's known puzzle
      And Bob is solving the game's known puzzle
      And Bob has taken a hint
      And Bob has solved the puzzle
      When Alice plays a wrong move
      Then Alice's puzzle rating is below 1500
      And Bob's puzzle rating is the same as Alice's

    Scenario: A solve after a hint gains less than a clean solve
      Given Bob has solved the game's known puzzle
      And Alice is solving the game's known puzzle
      And Alice has taken a hint
      When Alice solves the puzzle
      Then Alice's puzzle rating is below Bob's
