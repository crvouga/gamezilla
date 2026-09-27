@domain:sync
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

  Rule: A note never shows without its text

    @regression:garbled-live-update-blank-note
    Scenario: A garbled live update never shows a note without its text
      Given Alice and Bob are in the shared space "Trip"
      And the next live update will arrive garbled
      When Alice writes the note "Groceries" saying "milk"
      Then Bob never sees the note "Groceries" without its text
      And Bob sees the note "Groceries" saying "milk"
