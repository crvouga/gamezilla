@domain:runtime
Feature: Reopening a Sokoban puzzle after a move could not be saved
  When Alice's device cannot save her move, she wants to know where she can continue.

  Rule: Reopening the same puzzle attempt shows the last saved position

    Scenario: Alice reopens her first starter puzzle after a step could not be saved
      Given Alice is playing the first puzzle of the Sokoban starter pack
      When her device cannot save her first step to the right
      Then Alice is told her previous position is still saved
      And reopening that attempt shows zero moves and zero pushes
