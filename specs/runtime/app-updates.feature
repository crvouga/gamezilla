@domain:runtime @goal:always-true:1
Feature: An app too old for the product
  When a person's version of the app is too old for the product, they want
  to be asked to update the app rather than shown errors, so they can carry on
  with nothing they did lost.

  Scenario: A person on an outdated app is asked to update the app
    Given Alice's app became outdated while Alice was offline
    When the connection comes back
    Then Alice is asked to update the app within 15 seconds

  Scenario: What was done on an outdated app is still there after updating
    Given Alice is signed in
    And Alice's username is @alice_before
    And Alice's app is older than the product accepts
    When Alice updates the app
    Then Alice's profile shows @alice_before
