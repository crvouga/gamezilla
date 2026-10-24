@domain:puzzles
Feature: Author private puzzle drafts
  When Alice creates a puzzle, she wants to keep and improve her work privately, so publication is always her choice.

  Rule: A new puzzle belongs to its author and remains private

    Scenario: A new puzzle is kept as a private draft
      Given Alice has chosen a game offering puzzle creation
      When Alice creates the puzzle draft "River"
      Then Alice has a private puzzle draft titled "River"
      And Bob cannot discover the puzzle "River"

    Scenario: Knowing a private puzzle's name does not reveal its draft
      Given Alice owns the puzzle draft "River"
      When Bob opens Alice's puzzle draft "River"
      Then Bob is told that puzzle draft is private
      And Bob cannot read the puzzle details

  Rule: Saving a draft keeps incomplete work and metadata
    No counter-example: validation belongs to publication; an incomplete draft is still worth keeping.

    Scenario: A saved description and difficulty remain after reopening
      Given Alice owns the puzzle draft "River"
      And Alice has changed its description to "Connect the riverbanks" and difficulty to "Gentle"
      When Alice saves the puzzle draft
      Then Alice's reopened draft describes "Connect the riverbanks" with difficulty "Gentle"

    Scenario: An incomplete puzzle is still saved as a draft
      Given Alice owns a puzzle draft "River" with missing required details
      When Alice saves the puzzle draft
      Then Alice can resume editing the incomplete puzzle draft "River"

  Rule: Only the author changes a draft

    Scenario: An author can change the draft's title
      Given Alice owns the puzzle draft "River"
      When Alice renames the puzzle draft to "Valley"
      Then Alice has a private puzzle draft titled "Valley"

    Scenario: Another person cannot replace the author's work
      Given Alice owns the puzzle draft "River"
      When Bob renames Alice's puzzle draft to "Valley"
      Then Bob is told only the author may change that puzzle
      And Alice's puzzle draft is still titled "River"

    Scenario: Another person cannot choose the author's kept copy
      Given Alice owns the puzzle draft "River"
      When Bob chooses Alice's draft copy "River"
      Then Bob is told only the author may change that puzzle
      And Alice's puzzle draft is still titled "River"

  Rule: Different edits made from an earlier draft both remain recoverable
    No counter-example: agreeing edits may share one result, but neither person's different work may disappear.

    Scenario: Two devices keep their different draft titles
      Given Alice's phone and tablet had the puzzle draft "River"
      And Alice has saved the title "Valley" on her phone
      When Alice saves the title "Harbor" from her tablet's earlier draft
      Then Alice can choose the draft copy "Valley" or "Harbor"
      And Alice is told both draft copies were kept

    Scenario: Choosing a kept copy makes it the working draft
      Given Alice has kept the draft copies "Valley" and "Harbor"
      When Alice chooses the draft copy "Harbor"
      Then Alice has a private puzzle draft titled "Harbor"
      And Alice can choose the draft copy "Valley" or "Harbor"
