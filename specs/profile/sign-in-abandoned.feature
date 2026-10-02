@domain:profile
Feature: Abandon signing in
  When a guest starts signing in and changes their mind, they want to stay
  exactly the guest they were, with nothing lost, so they can sign in
  whenever they are ready.

  Rule: Abandoning signing in keeps the guest's profile and permits signing in later

    Scenario: A guest who abandons Google sign-in stays a guest with their name
      Given Alice is a guest
      And Alice's username is @alice_guest
      When Alice abandons signing in with Google
      Then Alice still has no account
      And Alice's profile shows @alice_guest

    Scenario: A guest who abandoned signing in with Google can sign in later
      Given Alice is a guest
      And Alice has abandoned signing in with Google
      When Alice signs in with Google
      Then Alice has a signed-in account
