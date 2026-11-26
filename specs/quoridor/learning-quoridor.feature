@domain:quoridor
Feature: Learn Quoridor on a practice board
  When Alice is new to Quoridor, she wants to try its moves in private, so she can learn before playing with others.

  Rule: A practice step advances after the player makes the move it teaches

    @regression:quoridor-how-to-play-only-text
    Scenario: South moves a pawn in the Classic Quoridor lesson
      Given Alice has chosen Classic Quoridor for her space
      When Alice opens its lesson
      Then Alice can move South's pawn from e1 to e2 on the practice board

    Scenario: Alice can try the forward move again after moving sideways
      Given Alice is practising South's first move
      When Alice moves the practice pawn to d1
      Then Alice can still try South's forward move from e1

    Scenario: Making the forward move unlocks the next practice step
      Given Alice is practising South's first move
      When Alice moves the practice pawn to e2
      Then Alice can continue to the lesson on placing a wall
