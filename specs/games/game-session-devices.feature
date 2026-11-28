@domain:games
Feature: One game session across a person's devices
  When a participant uses another device, they want the same side and game session there, so a second device cannot create a second turn or overwrite a finished result.

  Rule: The participating account holds the same side on each connected device

    Scenario: Another device sees the participant's current side
      Given Alice has a recently proven account
      And Alice and Bob have a game session after Alice's first move
      When Alice returns to the game session on another device
      Then it is Bob's turn on both of Alice's devices
      And both of Alice's devices show her move in the move list

    Scenario: Two devices cannot make the same turn's move twice
      Given Alice has a recently proven account
      And Alice and Bob have a new game session
      And Alice has the game session open on another device
      When Alice makes her move on both devices at the same time
      Then the move list shows her move once
      And it is Bob's turn on both of Alice's devices

  Rule: Reconnecting a device shows the current game session without reviving its older board

    Scenario: Another device sees a resignation made while it was offline
      Given Alice has a recently proven account
      And Alice and Bob have a game session under way
      And Alice's other device is offline with the game session open
      And Bob has resigned the game session
      When Alice's other device comes back online
      Then both of Alice's devices show her victory by resignation

    Scenario: An offline second device cannot move after the first device finishes
      Given Alice has a recently proven account
      And Alice and Bob have a game session under way
      And Alice's other device is offline with the game session open
      And Bob has resigned the game session
      When Alice makes a move on her offline other device
      Then Alice is told the game needs a connection on her other device
      And the finished game session is unchanged
