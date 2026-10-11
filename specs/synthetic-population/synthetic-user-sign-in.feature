@domain:synthetic-population
Feature: Synthetic Users sign in with a sign-in link
  When a Synthetic User signs in, the team wants it to get in through the same
  app as people, with a sign-in link sent to its own email address, so no
  person is ever offered a sign-in link and no real mail is ever sent.

  Rule: A Synthetic User signs in through the same app as people, with a sign-in link sent to its own email address
    No counter-example: only the Synthetic Population can read its mailbox, so nothing a person does comes between a Synthetic User and its own sign-in link.

    @regression:password-form-macro-runtime
    Scenario: A Synthetic User signs in with a sign-in link sent to its own email address
      Given the Synthetic User "Cedar" has never signed in
      When the Synthetic User "Cedar" signs in with a sign-in link sent to its own email address
      Then the Synthetic User "Cedar" is signed in

    Scenario: A Synthetic User that signs in again gets back into its same account
      Given the Synthetic User "Cedar" has signed out
      When the Synthetic User "Cedar" signs in with a sign-in link sent to its own email address
      Then the Synthetic User "Cedar" keeps its account and username

  Rule: A sign-in link is sent only for a Synthetic User's email address, and arrives only in the Synthetic Population's mailbox

    Scenario: A Synthetic User's sign-in link arrives in the Synthetic Population's mailbox
      Given the Synthetic User "Cedar" has never signed in
      When the Synthetic User "Cedar" asks for a sign-in link at its own email address
      Then the sign-in link arrives in the Synthetic Population's mailbox
      And no real mail is sent

    Scenario: An email address that is not a Synthetic User's is never sent a sign-in link
      Given no Synthetic User has the email address "eve@example.com"
      When Eve tries to ask for a sign-in link at "eve@example.com"
      Then no sign-in link arrives in the mailbox of "eve@example.com"
      And Eve still has no account

  Rule: A person signs in with Google or Apple and is never offered a sign-in link

    Background:
      Given Bob is a guest

    Scenario: A person signs in with Google
      When Bob signs in with Google
      Then Bob has a signed-in account

    Scenario: A person is not offered a sign-in link
      When Bob starts signing in
      Then Bob is not offered a sign-in link
