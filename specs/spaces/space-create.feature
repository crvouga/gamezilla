@domain:spaces
Feature: Create a space
  When a person creates a space, they want it in their lobby straight away, so
  they can return to it whenever they step out.

  Rule: Creating a space makes the person its host and lists it in their lobby
    No counter-example: an accepted creation always makes the person its host; the hosting limit refuses a creation that is not allowed.

    Scenario: Creating a space lists it in the host's lobby
      Given Alice is signed in
      When Alice creates a space
      Then Alice's lobby lists Alice's space
