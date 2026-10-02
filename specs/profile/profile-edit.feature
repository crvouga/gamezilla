@domain:profile
Feature: Edit a profile
  When a person wants to be recognized, they want to choose their own
  username and avatar, so their profile shows what they saved.

  Rule: Saving changes a profile and leaving without saving keeps the saved profile

    Scenario: A guest changes their username
      Given Alice is a guest
      When Alice renames themselves to @knight_rider
      Then Alice's profile shows @knight_rider

    Scenario: A signed-in person changes their username
      Given Alice is signed in
      When Alice renames themselves to @alice_w
      Then Alice's profile shows @alice_w

    Scenario: A guest changes and saves their avatar
      Given Alice is a guest
      When Alice saves an avatar with seed "sunflower" and style "Bottts"
      Then Alice's saved avatar has seed "sunflower"
      And Alice's saved avatar uses style "Bottts"

    Scenario: A signed-in person changes and saves their avatar
      Given Alice is signed in
      When Alice saves an avatar with seed "moonbeam" and style "Bottts"
      Then Alice's saved avatar has seed "moonbeam"
      And Alice's saved avatar uses style "Bottts"

    Scenario: An avatar draft left without saving keeps the saved avatar
      Given Alice has saved an avatar with seed "kept-seed" and style "Bottts"
      When Alice changes the avatar seed to "discarded-seed" and leaves without saving
      Then Alice's saved avatar has seed "kept-seed"
