@domain:sync-engine
Feature: Write a note
  When a person writes a note, they want it there the moment it is written,
  kept, and reaching the people it is shared with, so nobody wonders whether
  what they wrote was kept.

  Rule: A note shows on its writer's device at once and is kept

    Scenario: A new note shows at once on its writer's device
      When Alice writes the note "Groceries" saying "milk"
      Then Alice sees the note "Groceries" at once

    Scenario: A note keeps its title and body after the app reopens
      Given Alice has written the note "Groceries" saying "milk"
      When Alice's app closes and reopens
      Then Alice sees the note "Groceries" saying "milk"

  Rule: A note reaches everyone it is shared with

    Scenario: A note one person writes reaches the other people in the shared space
      Given Alice and Bob are in the shared space "Trip"
      When Alice writes the note "Groceries" saying "milk"
      Then Bob sees the note "Groceries" saying "milk"

  Rule: A change to many notes at once reaches everyone

    Scenario: A change to 100 notes at once reaches everyone
      Given Alice has written 100 notes that have reached Bob
      When Alice changes all 100 notes at once to say "done"
      Then Bob sees all 100 notes saying "done"

    Scenario: A change to 64 notes at once reaches someone whose app cannot send
      Given Alice has written 64 notes that have reached Bob
      And Bob's app cannot send
      When Alice changes all 64 notes at once to say "done"
      Then Bob sees all 64 notes saying "done"

    Scenario: A change to 65 notes at once reaches everyone, each note once
      Given Alice has written 65 notes that have reached Bob
      When Alice changes all 65 notes at once to say "done"
      Then Bob sees all 65 notes saying "done"
      And Bob sees exactly 65 notes

  Rule: A note never shows without its text

    @regression:garbled-live-update-blank-note
    Scenario: A garbled live update never shows a note without its text
      Given Alice and Bob have slow connections
      And live updates have stopped for a while and started again
      And the next live update to Bob will arrive garbled
      When Alice writes the note "Groceries" saying "milk"
      Then Bob never sees the note "Groceries" without its text
      And Bob sees the note "Groceries" saying "milk"

  Rule: A note never goes back to what it said before

    Scenario: However live updates are lost, repeated and delayed, nobody sees a note go back to what it said before
      Given Alice and Bob are in the shared space "Trip"
      And live updates to Alice and Bob are lost, repeated and delayed at random
      When Alice and Bob keep writing notes
      Then neither Alice nor Bob ever sees a note go back to what it said before
