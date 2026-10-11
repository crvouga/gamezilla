@domain:auth
Feature: Sign in with a sign-in link
  When a person wants to get into their account with nothing but their
  email address, they want a sign-in link sent to its mailbox, so only someone
  who can read that mailbox ever gets into the account that belongs to it.

  Rule: Opening a sign-in link signs the person into the account that belongs to its email address

    Scenario: The first sign-in link opened for an email address starts its account
      Given Alice has no account yet
      And Alice has asked for a sign-in link at "alice@example.com"
      When Alice opens the sign-in link
      Then Alice is signed into a new account

    Scenario: A later sign-in link for the same email address gets into the same account
      Given Alice has signed in with a sign-in link sent to "alice@example.com"
      And Alice has signed out
      And Alice has asked for a sign-in link at "alice@example.com"
      When Alice opens the sign-in link
      Then Alice is signed into the same account

    Scenario: Someone who cannot read the mailbox cannot get into the account
      Given Alice has signed in with a sign-in link sent to "alice@example.com"
      When Eve asks for a sign-in link at "alice@example.com"
      Then the sign-in link arrives in the mailbox of "alice@example.com"
      And Eve cannot open the sign-in link
      And Eve is signed out

  Rule: A sign-in link works once, and lapses 10 minutes after it was asked for

    Scenario: A sign-in link opened 9 minutes after it was asked for still works
      Given Alice asked for a sign-in link at "alice@example.com" 9 minutes ago
      When Alice opens the sign-in link
      Then Alice is signed into a new account

    Scenario: A sign-in link opened 11 minutes after it was asked for has lapsed
      Given Alice asked for a sign-in link at "alice@example.com" 11 minutes ago
      When Alice opens the sign-in link
      Then Alice is told the sign-in link no longer works
      And Alice is signed out

    Scenario: A sign-in link that has signed someone in does not work a second time
      Given Alice has signed in with a sign-in link sent to "alice@example.com"
      And Alice has signed out
      When Alice opens the same sign-in link again
      Then Alice is told the sign-in link no longer works
      And Alice is signed out

  Rule: Asking for a sign-in link never shows whether an account belongs to the email address
    No counter-example: whoever asks, at whatever email address, is told the same thing.

    Scenario: Asking at an email address that has an account says only that a sign-in link is on its way
      Given Alice has signed in with a sign-in link sent to "alice@example.com"
      When Eve asks for a sign-in link at "alice@example.com"
      Then Eve is told a sign-in link is on its way to "alice@example.com"

    Scenario: Asking at an email address that has no account also says only that a sign-in link is on its way
      Given Bob has no account yet
      When Eve asks for a sign-in link at "bob@example.com"
      Then Eve is told a sign-in link is on its way to "bob@example.com"

  Rule: A sign-in link can be asked for only in an environment that has a way to send mail

    Scenario: An environment with a way to send mail sends the sign-in link asked for
      Given this environment has a way to send mail
      When Alice asks for a sign-in link at "alice@example.com"
      Then the sign-in link arrives in the mailbox of "alice@example.com"

    Scenario: An environment with no way to send mail offers nobody a sign-in link
      Given this environment has no way to send mail
      When Alice starts signing in
      Then Alice is not offered a sign-in link
