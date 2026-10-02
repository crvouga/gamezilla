@domain:chess-board
Feature: Queue moves while waiting for the other side
  When Alice is waiting for the other side to move, Alice wants to queue a
  premove, so the intended reply can follow without changing the position early.

  Rule: Enabled premoves preview a waiting-side move while its real piece stays put

    Scenario: Selection queues a premove with a translucent destination preview
      Given Alice has a chessboard waiting for Black with premoves enabled
      When Alice queues the premove from d2 to d4
      Then Alice sees a translucent White pawn preview on d4
      And Alice sees the White pawn remaining on d2
      And Alice's activity receives no moves

    Scenario: Dragging queues the same waiting-side premove
      Given Alice has a chessboard waiting for Black with premoves enabled
      When Alice drags a premove from d2 to d4
      Then Alice sees a translucent White pawn preview on d4
      And Alice sees the White pawn remaining on d2
      And Alice's activity receives no moves

    @regression:chessboard-duplicate-premove
    Scenario: Repeating a waiting move keeps exactly one preview and queued move
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice queues the premove from d2 to d4
      Then Alice still sees exactly one translucent White pawn preview on d4
      And Alice sees only the premove from d2 to d4 queued
      And Alice hears no chessboard sounds
      And Alice's activity receives no moves

    Scenario: The waiting side may select a premove source
      Given Alice has a chessboard waiting for Black with premoves enabled
      When Alice selects the piece on d2
      Then Alice has d2 selected
      And Alice's activity receives no moves

    Scenario: Disabled premoves ignore waiting-side selection
      Given Alice has a chessboard waiting for Black with premoves disabled
      When Alice selects the piece on d2
      Then Alice cannot select White's pawn while Black is to move
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: Disabled premoves refuse queueing a waiting-side move
      Given Alice has a chessboard waiting for Black with premoves disabled
      When Alice queues the premove from d2 to d4
      Then Alice cannot queue a premove while premoves are disabled
      And Alice sees no queued premoves
      And Alice sees the White pawn remaining on d2
      And Alice's activity receives no moves

    Scenario: Enabling premoves permits a future waiting-side choice
      Given Alice has a chessboard waiting for Black with premoves disabled
      When Alice's board settings enable premoves
      Then Alice can queue a premove while waiting for Black

  Rule: Each opponent reply completes at most one queued premove in order

    Scenario: A legal opponent reply completes the first queued premove once
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice's activity supplies Black's reply from e7 to e5
      Then Alice sees a White pawn on d4
      And Alice sees no queued premoves
      And Alice's activity receives one move

    Scenario: Two queued premoves keep the second waiting after the first reply
      Given Alice has premoves from d2 to d4 then g1 to f3 queued while waiting for Black
      When Alice's activity supplies Black's reply from e7 to e5
      Then Alice sees a White pawn on d4
      And Alice sees the White knight remaining on g1
      And Alice sees only the premove from g1 to f3 queued
      And Alice's activity receives one move

    Scenario: The next opponent reply completes the next queued premove
      Given Alice has completed the premove from d2 to d4 with g1 to f3 still queued
      When Alice's activity supplies Black's reply from g8 to f6
      Then Alice sees a White knight on f3
      And Alice sees no queued premoves
      And Alice's activity receives one move

    Scenario: An invalidated premove disappears without offering another move
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice's activity supplies a reply that invalidates the premove
      Then Alice cannot complete the premove because it is no longer legal
      And Alice sees no queued premoves
      And Alice's activity receives no moves

  Rule: Cancelling premoves removes every preview without moving its real pieces

    Scenario: Choosing an empty square clears the queued premove
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice selects the empty square a3
      Then Alice sees no queued premoves
      And Alice sees the White pawn remaining on d2
      And Alice's activity receives no moves

    Scenario: Escape clears the queued premove
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice cancels premoves with Escape
      Then Alice sees no queued premoves
      And Alice sees the White pawn remaining on d2
      And Alice's activity receives no moves

    Scenario: A personal circle choice clears the queued premove
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice marks e4 with a personal circle
      Then Alice sees no queued premoves
      And Alice sees the White pawn remaining on d2
      And Alice's activity receives no moves

    Scenario: Disabling premoves clears every waiting choice
      Given Alice has premoves from d2 to d4 then g1 to f3 queued while waiting for Black
      When Alice's board settings disable premoves
      Then Alice cannot keep a premove queued while premoves are disabled
      And Alice sees no queued premoves
      And Alice's activity receives no moves

    Scenario: An unrelated position abandons every queued premove
      Given Alice has the premove from d2 to d4 queued while waiting for Black
      When Alice's activity replaces the position
      Then Alice sees the replacement position
      And Alice sees no queued premoves
      And Alice's activity receives no moves
