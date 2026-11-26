@domain:runtime
Feature: Reopening a Sokoban puzzle after a move could not be saved
  When Alice's device cannot save her move, she wants to know where she can continue.

  Rule: Reopening the same puzzle attempt shows the last saved position

    Scenario: Alice saves her refused step once and reopens her first starter puzzle
      Given Alice is playing the first puzzle of the Sokoban starter pack
      When her device cannot save her first step to the right
      Then Alice is told her previous position is still saved
      When Alice chooses Retry once
      Then her puzzle shows one move and zero pushes
      And reopening that attempt shows one move and zero pushes
