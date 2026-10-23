@domain:puzzles
Feature: Keep personal puzzle attempts
  When Bob plays a published puzzle, he wants his place and chosen edition to stay available, so closing the app never costs his work.

  Rule: Starting a published puzzle creates personal play at its chosen edition

    Scenario: A published puzzle can be played independently
      Given Alice has published the puzzle "River"
      When Bob starts the standalone puzzle "River"
      Then Bob has an unfinished attempt at the published edition "River"

    Scenario: A private draft cannot be started as a public puzzle
      Given Alice owns a valid puzzle draft "River"
      When Bob starts the standalone puzzle "River"
      Then Bob is told that puzzle is not available
      And Bob has no ordinary attempt at "River"

  Rule: Accepted play is kept automatically and resumes at the same position
    No counter-example: closing the app is never a request to discard accepted play.

    Scenario: Reopening the app restores unfinished play
      Given Bob has made progress in the published puzzle "River"
      When Bob reopens the app
      Then Bob has the same unfinished puzzle position

    Scenario: Another person's attempt remains private
      Given Bob has made progress in the published puzzle "River"
      When Alice opens Bob's saved puzzle attempt
      Then Alice is told that puzzle attempt is private
      And Alice cannot read Bob's puzzle position

  Rule: History controls follow the game's supported history

    Scenario: Undo returns to the preceding kept position
      Given Bob has made progress in a puzzle offering undo and redo
      When Bob undoes his last puzzle action
      Then Bob sees the preceding puzzle position
      And Bob can redo that puzzle action

    Scenario: Redo restores the undone position
      Given Bob has undone a puzzle action
      When Bob redoes that puzzle action
      Then Bob sees the position before his undo

    Scenario: A fresh attempt has no earlier position to undo
      Given Bob has a fresh attempt in a puzzle offering undo and redo
      When Bob undoes his last puzzle action
      Then Bob is told there is no earlier puzzle position
      And Bob's fresh puzzle position is unchanged

    Scenario: A different action after undo replaces the redo choice
      Given Bob has undone a puzzle action
      When Bob plays a different puzzle action
      Then Bob cannot redo the replaced puzzle action
      And Bob's new puzzle position is kept

  Rule: Restarting keeps earlier attempts and completion
    No counter-example: a restart begins fresh play rather than erasing history.

    Scenario: A restart begins another attempt at the same edition
      Given Bob has made progress in the published puzzle "River"
      When Bob restarts that puzzle
      Then Bob has a fresh attempt at the same puzzle edition
      And Bob can still open his earlier attempt

    Scenario: Restarting a completed puzzle retains its completion
      Given Bob has completed the published puzzle "River"
      When Bob restarts that puzzle
      Then Bob has a fresh attempt at the same puzzle edition
      And "River" remains completed in Bob's progress

  Rule: Later publication and withdrawal keep existing attempts stable
    No counter-example: an attempt always belongs to the edition it started.

    Scenario: A saved attempt keeps its earlier edition after another publication
      Given Bob has made progress in the published puzzle "River"
      And Alice has a valid working draft titled "Valley"
      When Alice publishes her puzzle draft
      Then Bob can resume the same position at the earlier edition "River"
      And Bob can start the current puzzle edition "Valley" separately

    Scenario: A saved attempt remains playable after withdrawal
      Given Bob has made progress in the published puzzle "River"
      When Alice withdraws the puzzle "River"
      Then Bob can resume the same position at the earlier edition "River"
      And Bob cannot discover the puzzle "River"
