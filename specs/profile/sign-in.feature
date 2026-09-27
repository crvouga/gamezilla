@domain:profile @goal:social:1
Feature: Sign in and out
  When a person signs in, they want their profile to go with their account
  to every device they sign in on, and to sign out of this device whenever
  they choose.

  @goal:social:2 @goal:always-true:10
  Scenario: A guest keeps their profile when signing in
    Given Alice is a guest
    And Alice's username is @alice_guest
    And Alice has saved an avatar with seed "harbor" and style "Bottts"
    When Alice signs in with Google
    Then Alice's profile shows @alice_guest
    And Alice's saved avatar has seed "harbor"

  Scenario: Signing out signs this device out
    Given Alice is signed in with Google
    When Alice signs out
    Then Alice is signed out

  Scenario: Signing back in brings back the account's profile
    Given Alice is signed in with Google
    And Alice's username is @alice_account
    And Alice has signed out
    When Alice signs in with Google
    Then Alice's profile shows @alice_account

  Scenario: A new device shows the account's current username
    Given Alice is signed in
    And Alice's username is @alice_laptop
    When Alice's account opens on another device
    Then Alice's other device shows @alice_laptop

  Scenario: A username change on one device reaches the other
    Given Alice is signed in
    And Alice is also signed in on another device
    When Alice renames themselves to @alice_second on their other device
    Then Alice's profile shows @alice_second within 15 seconds
