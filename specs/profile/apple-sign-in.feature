@domain:profile
Feature: Sign in with Apple
  When a person prefers Apple, they want to sign in with their Apple
  account, so an Apple account at the same address as their Google account
  never splits them into two accounts.

  Scenario: A guest's first Apple sign-in gives them an account that signs in with Apple
    Given Alice is a guest
    When Alice signs in with Apple
    Then Alice has a signed-in account
    And Alice's sign-in methods are Apple

  Scenario: Apple sign-in at the same address as Google opens the same account
    Given Alice is signed in with Google
    And Alice has signed out
    When Alice signs in with Apple using the same address
    Then Alice is signed into the same account
    And Alice's sign-in methods are Google and Apple

  Scenario: Apple sign-in with a hidden address opens a separate account
    Given Alice is signed in with Google
    And Alice has signed out
    When Alice signs in with Apple and hides their address
    Then Alice is signed into a different account
