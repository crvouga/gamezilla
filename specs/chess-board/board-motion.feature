@domain:chess-board
Feature: Keep moving pieces coherent
  When positions change while pieces are moving, Alice wants the newest position
  to remain visible, so unfinished animations cannot bring old pieces back.

  Rule: Captures show one coherent arrival
    No counter-example: a completed capture always removes its victim.

    Scenario: A capture settles on the destination
      Given Alice has a chessboard ready for a capture
      When Alice moves the piece from e4 to d5
      Then Alice sees a White pawn on d5
      And Alice sees no captured piece after the animation

    @regression:chessboard-capture-interruption
    Scenario: A replacement position clears a capture remnant immediately
      Given Alice's capture from e4 to d5 is animating
      When Alice's activity replaces the position
      Then Alice sees no capture remnant
      And Alice sees the replacement position

    Scenario: A completed capture keeps its destination and removes its remnant
      Given Alice's capture from e4 to d5 is animating
      When Alice waits for the animation to finish
      Then Alice sees no unfinished animation
      And Alice sees no capture remnant
      And Alice sees the White pawn remaining on d5

    Scenario: Confirming the same capture preserves its current arrival
      Given Alice's capture from e4 to d5 is animating
      When Alice's activity supplies the same position again
      Then Alice sees the current capture still animating
      And Alice sees its capture remnant
      And Alice sees the White pawn remaining on d5

  Rule: Newer positions own displayed pieces despite an earlier interrupted arrival
    No counter-example: an interrupted arrival never owns a newer position.

    Scenario: An opponent reply owns the board before the capture finishes
      Given Alice's capture from e4 to d5 is animating
      When Alice's activity supplies Black's reply from g8 to f6
      Then Alice sees a Black knight on f6
      And Alice sees the White pawn remaining on d5
      And Alice sees no capture remnant

    Scenario: An old arrival cannot restore pieces after turning and replacement
      Given Alice's capture from e4 to d5 was interrupted by turning the chessboard
      And Alice's activity has supplied the replacement position
      When Alice's earlier interrupted arrival finishes
      Then Alice sees the replacement position
      And Alice sees no capture remnant
      And Alice sees no unfinished animation

    Scenario: An earlier capture cannot finish a newer capture at the same destination
      Given Alice's earlier capture from e4 to d5 was interrupted by a replacement
      And Alice's capture from e4 to d5 is animating again
      When Alice's earlier interrupted arrival finishes
      Then Alice sees the current capture still animating
      And Alice sees its capture remnant
      And Alice sees the White pawn remaining on d5

    Scenario: An earlier arrival cannot bring back a closed chessboard
      Given Alice's capture from e4 to d5 was interrupted by closing the chessboard
      When Alice's earlier interrupted arrival finishes
      Then Alice cannot see the chessboard because it is closed
      And Alice hears no chessboard sounds

    Scenario: An earlier arrival cannot alter a newly opened chessboard
      Given Alice's capture from e4 to d5 was interrupted by closing the chessboard
      And Alice's activity has started another chessboard at the normal opening
      When Alice's earlier interrupted arrival finishes
      Then Alice still sees the position before White's first move
      And Alice sees no capture remnant
      And Alice sees no unfinished animation

  Rule: Reduced motion places pieces immediately

    Scenario: A move animates when motion is enabled
      Given Alice has an interactive chessboard
      When Alice moves the piece from g1 to f3
      Then Alice sees the knight slide from g1 to f3

    @regression:chessboard-reduced-motion
    Scenario: Reduced motion interrupts a running slide
      Given Alice's move from g1 to f3 is animating
      When Alice's board settings enable reduced motion
      Then Alice sees no unfinished animation
      And Alice still sees a White knight on f3

    Scenario: Reduced motion interrupts a capture remnant
      Given Alice's capture from e4 to d5 is animating
      When Alice's board settings enable reduced motion
      Then Alice sees no capture remnant
      And Alice sees the White pawn remaining on d5

  Rule: A hidden chessboard settles without replaying old motion
    No counter-example: motion in an unseen chessboard always finishes at its current position.

    @regression:chessboard-hidden-motion
    Scenario: Showing a chessboard does not replay a completed move
      Given Alice has a hidden chessboard after capturing from e4 to d5
      When Alice's chessboard becomes visible
      Then Alice sees no unfinished animation
      And Alice sees no capture remnant
      And Alice sees the White pawn remaining on d5
