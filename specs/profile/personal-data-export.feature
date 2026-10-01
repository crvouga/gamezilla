@domain:profile
Feature: Take a private copy of personal data
  When a person wants to keep or move their information, they want a
  personal-data export, so they can read and reuse what the product knows about them.

  Rule: Only the recently proven account can ask for its export

    Scenario: A person requests their own export
      Given Alice has a recently proven account
      When Alice asks for a personal-data export
      Then Alice sees that the export is being prepared
      And Alice sees when it must be ready

    Scenario: Old proof requires signing in again
      Given Alice completed signing in more than 10 minutes ago
      When Alice asks for a personal-data export
      Then Alice is told to prove the account again before exporting personal data

    Scenario: An offline request is refused plainly
      Given Alice has a recently proven account
      And Alice is offline
      When Alice asks for a personal-data export
      Then Alice is told the personal-data export needs a connection

  Rule: An export covers all the person's retained personal data and is ready within 24 hours

    Scenario: An export includes readable and reusable personal data
      Given Alice has asked for a personal-data export
      When Alice's personal-data export becomes ready
      Then Alice can download a readable summary and reusable detail within 24 hours of asking
      And the export includes every category of Alice's retained personal data

    Scenario: Another person's private information cannot appear in an export
      Given Alice and Bob have separate accounts with personal data
      When Alice's personal-data export becomes ready
      Then Bob's private personal data cannot appear in Alice's export

    Scenario: A failed export never pretends its incomplete answer is complete
      Given Alice has asked for a personal-data export
      When Alice's personal-data export fails
      Then Alice is told the export failed and can ask again
      And Alice is not offered an incomplete export as a complete answer

  Rule: Downloads belong to the proven account and expire after 7 days

    Scenario: The owner downloads a ready export
      Given Alice has a recently proven account
      And Alice's personal-data export has been ready for 6 days
      When Alice downloads the personal-data export
      Then Alice receives her personal-data export

    Scenario: Another account cannot download the same export
      Given Alice's personal-data export is ready
      And Bob has a recently proven account
      When Bob opens Alice's personal-data export address
      Then Bob cannot download it because the export belongs to Alice

    Scenario: An expired export cannot be downloaded
      Given Alice's personal-data export has been ready for 7 days
      When Alice downloads the personal-data export
      Then Alice is told the export has expired and can ask for a new one

    Scenario: Deletion withdraws a ready export
      Given Alice has a recently proven account
      And Alice's personal-data export is ready
      When Alice confirms account deletion
      Then Alice cannot download that export because the account has been deleted
