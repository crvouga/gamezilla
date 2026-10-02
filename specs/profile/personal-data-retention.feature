@domain:profile
Feature: End retention of deleted personal data
  When a person deletes their account, they want retention to end on a clear
  schedule, so deleted personal data cannot later return to ordinary use.

  Rule: Ordinary personal data is erased within 30 days of confirmed deletion

    Scenario: The team completes ordinary erasure by the promised deadline
      Given Alice confirmed account deletion 29 days ago
      When 1 day passes
      Then the team has erased Alice's ordinary personal data
      And only disclosed retention exceptions can remain

    Scenario: Deleted personal data cannot reappear in the product
      Given Alice's account deletion has been confirmed
      When Bob looks for Alice's profile
      Then Bob cannot find the deleted profile because Alice deleted the account

  Rule: A retention exception has a specific purpose and end condition

    Scenario: The person can see why an exception lasts
      Given Alice is reviewing account deletion
      When Alice opens the retention explanation
      Then Alice sees the minimum payment records kept for accounting and disputes
      And Alice sees any specific legal preservation obligation and its end condition

    Scenario: An exception cannot retain ordinary account use
      Given Alice's deleted account has personal data retained for a specific legal preservation obligation
      When the team reviews that retained personal data
      Then the team cannot use it to restore a profile or promote the product to Alice

  Rule: Active accounts keep their personal data until the person chooses deletion
    No counter-example: inactivity alone is not account deletion and never erases a person's progress without their choice.

    Scenario: Returning after a long absence keeps an active account's progress
      Given Alice has an account with personal data and has not asked for account deletion
      And Alice has not used the app for 2 years
      When Alice signs in with Google
      Then Alice has the same account and retained personal data
