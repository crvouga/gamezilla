@domain:puzzles
Feature: Undo and redo draft edits
  When Alice improves a draft, she wants to undo and redo her edits, so she can try different choices without losing kept work.

  Rule: Undo restores the preceding draft edit and retains saved draft copies

    Scenario: A title edit can be undone without losing either draft copy
      Given Alice owns the puzzle draft "River"
      And Alice has edited its draft title to "Valley"
      When Alice undoes her last draft edit
      Then Alice has a private puzzle draft titled "River"
      And Alice can choose the draft copy "River" or "Valley"
      And Alice is offered redo but no undo for her draft

    Scenario: Undoing the latest of two edits retains both choices
      Given Alice owns the puzzle draft "River"
      And Alice has edited its draft title to "Valley" and then "Harbor"
      When Alice undoes her last draft edit
      Then Alice has a private puzzle draft titled "Valley"
      And Alice is offered undo and redo for her draft

    Scenario: An edit to puzzle details can be undone
      Given Alice owns a puzzle draft "River" with missing required details
      And Alice has saved valid puzzle details
      When Alice undoes her last draft edit
      Then Alice can resume editing the incomplete puzzle draft "River"

    Scenario: A pack order edit can be undone
      Given Alice owns the pack draft "Rivers" containing "River, Valley"
      And Alice has moved "Valley" before "River" in the pack draft
      When Alice undoes her last draft edit
      Then the pack draft contains "River, Valley" in that order

    Scenario: An unchanged draft has no edit to undo or redo
      Given Alice owns the puzzle draft "River"
      When Alice saves the puzzle draft
      Then Alice is not offered undo or redo for her draft

  Rule: Redo restores an undone edit until a different edit replaces it

    Scenario: An undone title edit can be restored
      Given Alice owns the puzzle draft "River"
      And Alice has undone the draft title "Valley"
      When Alice redoes her last draft edit
      Then Alice has a private puzzle draft titled "Valley"
      And Alice is offered undo but no redo for her draft

    Scenario: Undone puzzle details can be restored
      Given Alice owns a puzzle draft "River" with missing required details
      And Alice has undone saving valid puzzle details
      When Alice redoes her last draft edit
      Then Alice's private puzzle draft has valid details

    Scenario: Redoing the first of two undone edits retains both choices
      Given Alice owns the puzzle draft "River"
      And Alice has undone the draft title edits "Valley" and "Harbor"
      When Alice redoes her last draft edit
      Then Alice has a private puzzle draft titled "Valley"
      And Alice is offered undo and redo for her draft

    Scenario: An undone pack order edit can be restored
      Given Alice owns the pack draft "Rivers" containing "River, Valley"
      And Alice has undone moving "Valley" before "River" in the pack draft
      When Alice redoes her last draft edit
      Then the pack draft contains "Valley, River" in that order

    Scenario: A different title edit replaces the redo choice
      Given Alice owns the puzzle draft "River"
      And Alice has undone the draft title "Valley"
      When Alice renames its working draft to "Harbor"
      Then Alice's working draft is titled "Harbor"
      And Alice cannot redo the replaced draft edit

  Rule: Draft undo and redo remain available without a connection
    No counter-example: a missing connection does not remove editing choices; the earlier rules still require an earlier or undone edit.

    Scenario: An offline title edit can be undone
      Given Alice owns the puzzle draft "River"
      And Alice has edited its draft title to "Valley"
      And Alice's phone has no connection
      When Alice undoes her last draft edit
      Then Alice has a private puzzle draft titled "River"

    Scenario: An undone title edit can be restored offline
      Given Alice owns the puzzle draft "River"
      And Alice has undone the draft title "Valley"
      And Alice's phone has no connection
      When Alice redoes her last draft edit
      Then Alice has a private puzzle draft titled "Valley"

    Scenario: An offline undo reaches the author's other device
      Given Alice's phone and tablet had the puzzle draft "River"
      And Alice has undone the draft title "Valley" on her offline phone
      When Alice's phone is back online
      Then Alice can edit the puzzle draft "River" on her tablet

  Rule: Reopening begins editing the kept draft with fresh undo and redo choices
    No counter-example: reopening keeps all draft copies rather than continuing earlier editing choices.

    Background:
      Given Alice owns the puzzle draft "River"

    Scenario: A reopened draft keeps its edited title
      Given Alice has edited its draft title to "Valley"
      When Alice reopens the app
      Then Alice can resume editing her private puzzle draft "Valley"
      And Alice is not offered undo or redo for her draft

    Scenario: A reopened draft keeps its undone title
      Given Alice has undone the draft title "Valley"
      When Alice reopens the app
      Then Alice can resume editing her private puzzle draft "River"
      And Alice is not offered undo or redo for her draft

    Scenario: Reopening clears earlier and undone editing choices together
      Given Alice has edited its draft title to "Valley" and then "Harbor"
      And Alice has undone her last draft edit
      When Alice reopens the app
      Then Alice is not offered undo or redo for her draft
