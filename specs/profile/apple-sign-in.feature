@domain:profile
Feature: Sign in with Apple
  Apple sign-in creates or resumes the account associated with that provider.

  Scenario: A first Apple sign-in creates an account with Apple as its method
    Given Alice is a guest
    When Alice signs in with Apple
    Then Alice can sign in with Apple

  Scenario: A verified address shared by Google and Apple identifies one account
    Given Alice is a guest
    When Alice signs in with Google and remembers the account
    And Alice signs out
    And Alice signs in with Apple using the shared address
    Then Alice is still signed into the remembered account
    And Alice has Google and Apple sign-in methods

  Scenario: Hide My Email keeps Apple separate from the Google account
    Given Alice is a guest
    When Alice signs in with Google and remembers the account
    And Alice signs out
    And Alice signs in with Apple using a private address
    Then Alice is signed into a different account
    And Alice can return to the tabs
