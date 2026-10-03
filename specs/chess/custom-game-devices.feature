@domain:chess
Feature: One Custom Game across a person's devices
  When a participant uses another device, they want the same side and game, so a second device cannot create a second turn or overwrite a finished result.

  Rule: The participating account controls the same side on each connected device

    Scenario: Another device sees the participant's current side
      Given Alice has a recently proven account
      And Alice has an active Custom Game after White's e4
      When Alice returns to the Custom Game on another device
      Then Black is to move on both of Alice's devices
      And Both of Alice's devices show the Custom Game move list with e4

    Scenario: Two devices cannot play White's turn twice
      Given Alice has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice has the Custom Game open on another device
      When Alice plays e2-e4 on both devices at the same time
      Then The Custom Game move list shows e4 once
      And Black is to move on both of Alice's devices

  Rule: Reconnecting a device restores the current game without reviving its older board

    Scenario: Another device sees a resignation that happened while it was away
      Given Alice has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice's other device is offline with the Custom Game open
      And Bob has resigned the Custom Game
      When Alice's other device returns online
      Then Both of Alice's devices show Alice's win by resignation

    Scenario: An offline second device cannot move after the first device finishes
      Given Alice has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      And Alice's other device is offline with the Custom Game open
      And Bob has resigned the Custom Game
      When Alice plays e2-e4 on the offline other device
      Then Alice is told Custom Games need a connection on the other device
      And The Custom Game keeps its completed outcome
