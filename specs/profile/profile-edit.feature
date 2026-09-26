@domain:profile @goal:social:3
Feature: Edit a profile
  A person can make their profile their own, and saved changes remain on it.

  Scenario: A guest changes their username
    Given Alice is a guest
    When Alice renames themselves to @guest_user_1
    Then Alice's profile shows @guest_user_1

  Scenario: A signed-in person changes their username
    Given Alice is signed in
    When Alice renames themselves to @signed_alice_1
    Then Alice's profile shows @signed_alice_1

  Scenario: A guest changes and saves their avatar
    Given Alice is a guest
    When Alice saves an avatar with seed "sim-seed-guest" and style "Bottts"
    Then Alice's saved avatar has seed "sim-seed-guest"
    And Alice's saved avatar uses style "Bottts"

  Scenario: A signed-in person changes and saves their avatar
    Given Alice is signed in
    When Alice saves an avatar with seed "sim-seed-signed" and style "Bottts"
    Then Alice's saved avatar has seed "sim-seed-signed"
    And Alice's saved avatar uses style "Bottts"

  Scenario: Leaving an edited avatar without saving keeps the prior avatar
    Given Alice has saved an avatar with seed "kept-seed" and style "Bottts"
    When Alice changes the avatar seed to "discarded-seed" and leaves without saving
    Then Alice's saved avatar has seed "kept-seed"
