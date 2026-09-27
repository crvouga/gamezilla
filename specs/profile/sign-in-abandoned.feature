@domain:profile @goal:always-true:10
Feature: Changing one's mind about signing in
  A guest who starts signing in and changes their mind stays exactly the guest
  they were, with nothing lost, and can sign in whenever they are ready.

  Scenario: A guest who abandons Google sign-in stays a guest with their name
    Given Alice is a guest
    And Alice's username is @alice_guest
    When Alice abandons signing in with Google
    Then Alice still has no account
    And Alice's profile shows @alice_guest

  Scenario: A guest who abandoned Google sign-in can sign in later
    Given Alice is a guest
    And Alice has abandoned signing in with Google
    When Alice signs in with Google
    Then Alice has a signed-in account
