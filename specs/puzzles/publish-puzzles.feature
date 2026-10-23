@domain:puzzles
Feature: Publish stable puzzle editions
  When Alice shares a puzzle, she wants validation and stable editions, so another person's saved play never changes underneath them.

  Rule: Only a validated draft with a title can be published

    Scenario: A valid draft becomes discoverable
      Given Alice owns a valid puzzle draft "River"
      When Alice publishes her puzzle draft
      Then Bob can discover the published puzzle "River"
      And Alice sees its published edition

    Scenario: Missing puzzle details refuse publication
      Given Alice owns a puzzle draft "River" with missing required details
      When Alice publishes her puzzle draft
      Then Alice is told to correct the puzzle details before publication
      And Bob cannot discover the puzzle "River"

    Scenario: A missing title refuses publication without losing the drawing
      Given Alice owns a valid puzzle draft with no title
      When Alice publishes her puzzle draft
      Then Alice is told to name the puzzle before publication
      And Alice can resume editing her puzzle details

  Rule: Draft edits do not change a published edition
    No counter-example: changing the public puzzle requires another validated publication.

    Scenario: Editing a published puzzle keeps its earlier title public
      Given Alice has published the puzzle "River"
      When Alice renames its working draft to "Valley"
      Then Bob can discover the published puzzle "River"
      And Alice's working draft is titled "Valley"

    Scenario: Republishing makes the chosen draft current
      Given Alice has published the puzzle "River"
      And Alice has a valid working draft titled "Valley"
      When Alice publishes her puzzle draft
      Then Bob can discover the published puzzle "Valley"
      And Alice can still inspect the earlier edition "River"

  Rule: Publishing the same saved draft again keeps one edition
    No counter-example: a newly saved draft is a different publication choice.

    Scenario: Repeated publication does not create another edition
      Given Alice has published the puzzle "River"
      When Alice publishes that same saved draft again
      Then Alice sees one published edition of "River"

    Scenario: An earlier publication cannot replace a later one
      Given Alice has published "Valley" after the earlier edition "River"
      When Alice publishes the earlier saved draft "River" again
      Then Bob can discover the published puzzle "Valley"

  Rule: Another person cannot publish or withdraw the author's puzzle

    Scenario: An author can withdraw a published puzzle
      Given Alice has published the puzzle "River"
      When Alice withdraws the puzzle "River"
      Then Bob cannot discover the puzzle "River"
      And Alice can still edit its working draft

    Scenario: Another person cannot publish a private draft
      Given Alice owns a valid puzzle draft "River"
      When Bob publishes Alice's puzzle draft
      Then Bob is told only the author may publish that puzzle
      And Bob cannot discover the puzzle "River"

    Scenario: Another person cannot withdraw a public puzzle
      Given Alice has published the puzzle "River"
      When Bob withdraws Alice's puzzle "River"
      Then Bob is told only the author may withdraw that puzzle
      And Bob can discover the published puzzle "River"
