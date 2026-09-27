@domain:runtime @goal:always-true:1
Feature: An app too old for the product
  When the product moves on, a person with an old version of the app is asked
  to update rather than shown errors, and nothing they did is lost.

  Scenario: An outdated app asks the person to update
    Given Alice's app is older than the product accepts
    When the connection comes back
    Then Alice is asked to update the app within 15 seconds

  Scenario: What was done on an outdated app is still there after updating
    Given Alice is signed in
    And Alice's username is @alice_before
    And Alice's app is older than the product accepts
    When Alice updates the app
    Then Alice's profile shows @alice_before
