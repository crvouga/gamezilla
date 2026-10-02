@domain:chess-board
Feature: Understand the chessboard without sound
  When Alice uses a keyboard or cannot hear the chessboard, Alice wants pieces
  and selections described, so choosing a move does not depend on sound.

  Rule: Each square communicates its piece and selection
    No counter-example: every square has an identity, including empty squares.

    @regression:chessboard-square-a11y
    Scenario: A selected piece communicates its destinations
      Given Alice has an interactive chessboard
      When Alice selects the piece on e2
      Then Alice can identify the White pawn on e2 without sound
      And Alice can identify e2 as selected without sound
      And Alice can identify e4 as a legal destination without sound

    Scenario: Empty squares communicate their identity
      Given Alice has an interactive chessboard
      When Alice selects the piece on g1
      Then Alice can identify e4 as empty without sound

  Rule: Keyboard moves follow the same legality as other moves

    Scenario: A legal keyboard move offers one move
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e4 with the keyboard
      Then Alice sees a White pawn on e4
      And Alice's activity receives one move

    Scenario: An illegal keyboard destination does not move the piece
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e5 with the keyboard
      Then Alice cannot move White's pawn from e2 to the illegal destination e5
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

  Rule: Arrow keys move the keyboard in the direction Alice sees and stop at the edge

    Scenario Outline: A White-facing chessboard follows each arrow direction
      Given Alice has a chessboard facing White with the keyboard on e4
      When Alice moves the keyboard one square <direction>
      Then Alice's keyboard is on <destination>
      And Alice's activity receives no moves

      Examples:
        | direction | destination |
        | up        | e5          |
        | down      | e3          |
        | left      | d4          |
        | right     | f4          |

    Scenario Outline: A Black-facing chessboard follows each arrow direction
      Given Alice has a chessboard facing Black with the keyboard on e4
      When Alice moves the keyboard one square <direction>
      Then Alice's keyboard is on <destination>
      And Alice's activity receives no moves

      Examples:
        | direction | destination |
        | up        | e3          |
        | down      | e5          |
        | left      | f4          |
        | right     | d4          |

    Scenario Outline: White-facing arrow movement stops at every edge
      Given Alice has a chessboard facing White with the keyboard on <square>
      When Alice moves the keyboard one square <direction>
      Then Alice cannot move the keyboard beyond the chessboard's edge
      And Alice's keyboard is on <square>

      Examples:
        | square | direction |
        | e8     | up        |
        | e1     | down      |
        | a4     | left      |
        | h4     | right     |

    Scenario Outline: Black-facing arrow movement stops at every edge
      Given Alice has a chessboard facing Black with the keyboard on <square>
      When Alice moves the keyboard one square <direction>
      Then Alice cannot move the keyboard beyond the chessboard's edge
      And Alice's keyboard is on <square>

      Examples:
        | square | direction |
        | e1     | up        |
        | e8     | down      |
        | h4     | left      |
        | a4     | right     |

  Rule: Space chooses the keyboard's square using the same selection and move rules

    Scenario: Space selects a movable piece
      Given Alice has a chessboard facing White with the keyboard on e2
      When Alice chooses the keyboard's square with Space
      Then Alice has e2 selected
      And Alice's activity receives no moves

    Scenario: Space on the selected source deselects it
      Given Alice has e2 selected with the keyboard on e2
      When Alice chooses the keyboard's square with Space
      Then Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: Space on a legal destination completes the selected move
      Given Alice has e2 selected with the keyboard on e4
      When Alice chooses the keyboard's square with Space
      Then Alice sees a White pawn on e4
      And Alice sees no selection or legal destinations
      And Alice's activity receives one move

    Scenario: Disabled interactivity refuses Space selection
      Given Alice has a chessboard with interactivity disabled and the keyboard on e2
      When Alice chooses the keyboard's square with Space
      Then Alice cannot select a piece while interactivity is disabled
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

  Rule: Choosing a square gives that square the keyboard
    No counter-example: an available chosen square always has a keyboard identity.

    Scenario: Choosing a piece gives its source the keyboard
      Given Alice has an interactive chessboard
      When Alice selects the piece on e2
      Then Alice's keyboard is on e2
      And Alice has e2 selected

    Scenario: Choosing an empty square gives it the keyboard
      Given Alice has an interactive chessboard
      When Alice selects the empty square e4
      Then Alice's keyboard is on e4
      And Alice sees no selection or legal destinations
