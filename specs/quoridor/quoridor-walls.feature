@domain:quoridor
Feature: Place Quoridor walls without closing a goal
  When Alice places a Quoridor wall, she wants to delay other pawns fairly, so every player keeps a route to the goal.

  Rule: Each wall spans two adjacent square boundaries entirely inside the board

    Scenario: A horizontal wall spends one wall and passes the turn
      Given Alice has a new Classic Quoridor game
      When Alice places a horizontal Quoridor wall at d4
      Then the Quoridor wall blocks d4 to d5 and e4 to e5
      And South has nine remaining walls and North has the Quoridor turn

    Scenario: A vertical wall spans two rows
      Given Alice has a new Classic Quoridor game
      When Alice places a vertical Quoridor wall at d4
      Then the Quoridor wall blocks d4 to e4 and d5 to e5
      And South has nine remaining walls and North has the Quoridor turn

    Scenario: A wall cannot extend beyond the board edge
      Given Alice has a new Classic Quoridor game
      When Alice places a horizontal Quoridor wall at i4
      Then Alice is told the Quoridor wall would extend beyond the board
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: Walls may meet at their tips but cannot overlap or cross

    Scenario: Two horizontal walls may meet at their tips
      Given Alice has a Classic Quoridor game with a horizontal wall at b4
      When Alice places a horizontal Quoridor wall at d4
      Then both Quoridor walls are on the board
      And one of South's remaining walls is spent

    Scenario: The same wall cannot be placed twice
      Given Alice has a Classic Quoridor game with a horizontal wall at d4
      When Alice places a horizontal Quoridor wall at d4
      Then Alice is told the Quoridor wall overlaps another wall
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A wall cannot overlap half of another wall
      Given Alice has a Classic Quoridor game with a horizontal wall at d4
      When Alice places a horizontal Quoridor wall at e4
      Then Alice is told the Quoridor wall overlaps another wall
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A wall cannot cross the middle of another wall
      Given Alice has a Classic Quoridor game with a horizontal wall at d4
      When Alice places a vertical Quoridor wall at d4
      Then Alice is told the Quoridor wall crosses another wall
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: A wall must keep every player a path to the selected goal

    Scenario: A wall may make the remaining path longer
      Given Alice has a new Classic Quoridor game
      When Alice places a horizontal Quoridor wall at d8
      Then the Quoridor wall is on the board and every player has a path to the opposite home row

    Scenario: A wall cannot close the opposing pawn's last path
      Given Alice has a Classic Quoridor position where a vertical wall at e8 would close North's last path
      When Alice places a vertical Quoridor wall at e8
      Then Alice is told the Quoridor wall would block a player's last path to the goal
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A wall cannot close the placing player's own last path
      Given Alice has a Classic Quoridor position where a vertical wall at e1 would close South's last path
      When Alice places a vertical Quoridor wall at e1
      Then Alice is told the Quoridor wall would block a player's last path to the goal
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A hill wall cannot close any of the four players' last paths to the center
      Given Alice has a hill mode Quoridor position where a vertical wall at e4 would close East's last path to the hill
      When Alice places a vertical Quoridor wall at e4
      Then Alice is told the Quoridor wall would block a player's last path to the goal
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: A player with no remaining walls must move their pawn

    Scenario: The last wall can still be placed
      Given Alice has a Classic Quoridor game with one remaining wall
      When Alice places a horizontal Quoridor wall at d4
      Then South has no remaining walls and North has the Quoridor turn

    Scenario: An exhausted inventory refuses a wall placement
      Given Alice has a Classic Quoridor game with no remaining walls
      When Alice places a horizontal Quoridor wall at d4
      Then Alice is told South has no remaining Quoridor walls
      And the Quoridor board, remaining walls and turn are unchanged
