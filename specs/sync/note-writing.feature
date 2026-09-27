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
