@domain:puzzles
Feature: Keep each edition with the rules it was published under
  When a game's rules change, Bob wants a puzzle published earlier never to be played under rules its author did not publish it with, so a rules change never quietly changes or costs his play.

  Rule: An edition is started only under the rules it was published under

    Scenario: An edition published after a rules change can be started
      Given Alice has published the puzzle "River" after the game's rules changed
      When Bob starts the standalone puzzle "River"
      Then Bob has an unfinished attempt at the published edition "River"

    Scenario: An edition published before a rules change is not started under the changed rules
      Given Alice has published the puzzle "River" before the game's rules changed
      When Bob starts the standalone puzzle "River"
      Then Bob is told that puzzle needs a version of the app with its rules
      And Bob has no ordinary attempt at "River"

    Scenario: Republishing after a rules change makes an edition that can be started
      Given Alice has published the puzzle "River" before the game's rules changed
      And Alice has a valid working draft titled "Valley"
      When Alice publishes her puzzle draft
      Then Bob can start the current puzzle edition "Valley" separately

  Rule: A saved attempt whose edition's rules changed is kept but not continued

    Background:
      Given Bob has made progress in the published puzzle "River"

    Scenario: A saved attempt resumes while its edition's rules are unchanged
      When Bob resumes his saved attempt at "River"
      Then Bob has the same unfinished puzzle position

    Scenario: A saved attempt is kept but not resumed after a rules change
      Given the game's rules have changed since "River" was published
      When Bob resumes his saved attempt at "River"
      Then Bob is told that puzzle needs a version of the app with its rules
      And Bob's saved attempt at "River" is kept

    Scenario: A rules change during play stops the play and keeps the attempt
      When the game's rules change
      Then Bob is told that puzzle needs a version of the app with its rules
      And Bob's saved attempt at "River" is kept
