@domain:spaces
Feature: A guest can host
  When a guest wants to be somewhere with other people, they want to create a
  space and host it without an account, so nobody has to sign in first.

  Rule: A guest can create and end their own space
    No counter-example: needing an account never stops these choices; the hosting limit applies to guests too.

    Scenario: A guest creates a space and hosts it
      Given Alice is a guest
      When Alice creates a space
      Then Alice is in the space
      And Alice can end the space

    Scenario: A guest host can end their own space
      Given Alice is a guest
      And Alice is hosting a space
      When Alice ends the space
      Then Alice is not in a space
