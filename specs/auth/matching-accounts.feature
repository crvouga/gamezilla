@domain:auth
Feature: Confirming a matching account
  When a person signs in with a new outside account at the email address an
  account they already have uses, they want to confirm that account is
  theirs by signing in the way they usually do, so nobody else's outside
  account ever gets into their account.

  Rule: A new outside account becomes a sign-in method of a matching account at once only when both email addresses are verified

    Scenario: Eve's Apple account becomes a sign-in method of Eve's account at once
      Given Eve has an account they sign into with Google
      When Eve signs in with their Apple account
      Then Eve is signed into the same account
      And Eve's sign-in methods are Google and Apple

    Scenario: Carol's Apple account at an unverified email address waits to be confirmed
      Given Carol has an account they sign into with Google
      When Carol signs in with their Apple account
      Then Carol is told to confirm the matching account first
      And Carol is signed out

  Rule: Only an outside account of the matching account confirms it

    Scenario: Confirming with Carol's own Google account adds Apple to Carol's account
      Given Carol is being asked to confirm the matching account with Google
      When Carol confirms the matching account with Google
      Then Carol is signed into the same account
      And Carol's sign-in methods are Google and Apple

    Scenario: Confirming with someone else's Google account keeps Carol signed out
      Given Bob has an account they sign into with Google
      And Carol is being asked to confirm the matching account with Google
      When Carol confirms the matching account with Bob's Google account
      Then Carol is told the matching account could not be confirmed
      And Carol is signed out

  Rule: A person asked to confirm a matching account may keep the accounts separate instead
    No counter-example: the only thing that stops it is the 10 minute limit of the next rule.

    Scenario: Keeping the accounts separate starts a new account for Carol
      Given Carol is being asked to confirm the matching account with Google
      When Carol keeps the accounts separate
      Then Carol is signed into a new account

  Rule: The chance to confirm a matching account lapses after 10 minutes

    Scenario: Confirming 9 minutes after being asked still works
      Given Carol was asked to confirm the matching account with Google 9 minutes ago
      When Carol confirms the matching account with Google
      Then Carol is signed into the same account

    Scenario: Confirming 11 minutes after being asked is too late
      Given Carol was asked to confirm the matching account with Google 11 minutes ago
      When Carol confirms the matching account with Google
      Then Carol is told the chance to confirm has lapsed
      And Carol is signed out

    Scenario: Keeping the accounts separate 11 minutes after being asked is too late
      Given Carol was asked to confirm the matching account with Google 11 minutes ago
      When Carol keeps the accounts separate
      Then Carol is told the chance to confirm has lapsed
      And Carol is signed out
