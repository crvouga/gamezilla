@domain:profile @goal:social:1
Feature: Sign in and out
  A person can connect an account and later sign out on this device.

  @goal:social:2 @goal:always-true:10
  Scenario: A guest keeps profile changes when signing in
    Given Alice is a guest
    When Alice renames themselves to @guest_keeps_1
    And Alice saves an avatar with seed "carried-seed" and style "Bottts"
    And Alice returns to the tabs
    And Alice signs in with Google
    And Alice returns to the tabs
    Then Alice's profile shows username "guest_keeps_1"
    And Alice's saved profile avatar has seed "carried-seed"

  Scenario: A first sign-in can be followed by sign-out
    Given Alice is a guest
    When Alice signs in with Google
    And Alice signs out
    Then Alice can sign in again

  Scenario: Signing out and back in restores the account's profile
    Given Alice is signed in
    When Alice renames themselves to @alice_account
    And Alice signs out
    And Alice signs in with Google
    And Alice returns to the tabs
    Then Alice's profile shows username "alice_account"

  Scenario: The same account shares profile edits across devices
    Given Alice is signed in
    When Alice renames themselves to @alice_laptop
    And Alice's account opens on another device
    Then Alice's phone shows username "alice_laptop"
    When Alice's phone changes username to "alice_phone_1"
    Then Alice sees the phone's username "alice_phone_1"
