@domain:quoridor
Feature: Follow and control the Quoridor board
  When Alice plays Quoridor on her device, she wants clear pawn identities and accessible controls, so she can move and place walls without depending on color or motion.

  Rule: Pawns keep their side names and different shapes when played with the keyboard
    No counter-example: reduced motion changes presentation alone.

    Scenario: Keyboard play keeps all four pawn identities clear
      Given Alice has a new King of the Hill game with reduced motion
      When Alice moves her Quoridor pawn to e2 using the keyboard
      Then the Quoridor board identifies South's circle, West's diamond, North's triangle and East's square
      And West has the Quoridor turn

  Rule: A wall preview explains an invalid placement without spending a wall

    Scenario: A legal wall can be placed with the keyboard
      Given Alice has a new Classic Quoridor game
      When Alice places a horizontal Quoridor wall at d4 using the keyboard
      Then the Quoridor wall blocks d4 to d5 and e4 to e5
      And South has nine remaining walls and North has the Quoridor turn

    Scenario: A crossing preview explains the refusal and preserves the board
      Given Alice has a Classic Quoridor game with a horizontal wall at d4
      When Alice places a vertical Quoridor wall at d4 using the keyboard
      Then the Quoridor wall preview explains that it crosses another wall
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: A person without a side cannot change the board

    Scenario: A seated player can move their pawn
      Given Alice has a new Classic Quoridor game
      When Alice moves her Quoridor pawn to e2
      Then South's Quoridor pawn is on e2

    Scenario: A watcher cannot move a player's pawn
      Given Eve is watching Alice's new Classic Quoridor game
      When Eve moves her Quoridor pawn to e2
      Then Eve is told she is not a Quoridor player
      And the Quoridor board, remaining walls and turn are unchanged
