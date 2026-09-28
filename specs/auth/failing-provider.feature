@domain:auth
Feature: When Google or Apple is failing
  When Google or Apple cannot vouch for who is signing in, a person wants
  signing in to fail plainly and change nothing, so they can simply sign in
  once it recovers. When they vouch in a way that is unusual but sound,
  signing in still works.

  Rule: Signing in while a provider is failing fails plainly and changes nothing

    Scenario: Signing in while Google is failing keeps Alice signed out
      Given Google is failing
      When Alice tries to sign in with Google
      Then Alice is told signing in with Google failed
      And Alice is signed out

    Scenario Outline: When <failure>, signing in with <provider> fails plainly
      Given <failure>
      When Alice tries to sign in with <provider>
      Then Alice is told signing in with <provider> failed
      And Alice is signed out

      Examples:
        | provider | failure                                          |
        | Google   | Google cannot confirm Alice's sign-in            |
        | Google   | Google does not recognise the app                |
        | Google   | Google cannot say who Alice is                   |
        | Google   | Google refuses to say who Alice is               |
        | Apple    | Apple cannot confirm Alice's sign-in             |
        | Apple    | Apple's word for Alice cannot be checked as its own |
        | Apple    | Apple's word for Alice is two hours old          |
        | Apple    | Apple's word for Alice is dated ten minutes ahead |

  Rule: Once a provider recovers, signing in works

    Scenario: Once Google recovers, Alice can sign in
      Given Alice tried to sign in with Google while it was failing
      And Google has recovered
      When Alice signs in with their Google account
      Then Alice is signed into a new account

    Scenario Outline: Once <provider> recovers after <failure>, Alice can sign in
      Given <failure>
      And Alice has been told signing in with <provider> failed
      When <provider> recovers
      And Alice signs in with their <provider> account
      Then Alice is signed into a new account

      Examples:
        | provider | failure                                          |
        | Google   | Google cannot confirm Alice's sign-in            |
        | Google   | Google does not recognise the app                |
        | Google   | Google cannot say who Alice is                   |
        | Google   | Google refuses to say who Alice is               |
        | Apple    | Apple cannot confirm Alice's sign-in             |
        | Apple    | Apple's word for Alice cannot be checked as its own |
        | Apple    | Apple's word for Alice is two hours old          |
        | Apple    | Apple's word for Alice is dated ten minutes ahead |

  Rule: Unusual but sound word from Apple still signs in

    Scenario Outline: Signing in with Apple works when <quirk>
      Given Alice has no account yet
      And <quirk>
      When Alice signs in with their Apple account
      Then Alice is signed into a new account

      Examples:
        | quirk                                       |
        | Apple writes its yes and no answers as text |
        | Apple's clock is two minutes ahead          |

    Scenario: Signing in with Apple still works after Apple changes how its word is checked
      Given Alice is signed in with their Apple account
      And Alice has signed out
      And Apple has changed how its word is checked
      When Alice signs in with their Apple account
      Then Alice is signed into the same account
