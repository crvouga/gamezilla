@domain:runtime
Feature: Keep recovery and investigation private
  When the team recovers the product or investigates trouble, people want
  deleted personal data to stay deleted, so recovery and investigation do not extend ordinary retention.

  Rule: Recovery copies cannot revive confirmed account deletions

    Scenario: Recovery keeps active people's saved progress
      Given a recovery copy has Bob's active account and personal data
      When the team recovers the app from that recovery copy
      Then Bob can use the recovered personal data

    Scenario: Recovery cannot revive a deleted account
      Given a recovery copy contains Alice's personal data from before confirmed account deletion
      When the team recovers the app from that recovery copy
      Then Alice's deleted account cannot become usable again
      And Alice's ordinary personal data cannot return to use

  Rule: Routine investigation trails expire after 30 days

    Scenario: A recent trail remains available to investigate trouble
      Given Alice's trail was recorded 29 days ago
      When the team follows that trail
      Then the team can read that trail

    Scenario: An expired routine trail cannot be retained for ordinary investigation
      Given Alice's trail was recorded 30 days ago
      And no specific legal preservation obligation applies to it
      When the team follows that trail
      Then the team cannot read that trail because its retention period has expired

    Scenario: A trail that was never written cannot be read
      Given Alice has no trail
      When the team follows that trail
      Then the team cannot read that trail because nothing was written down

  Rule: People never see a trail
    No counter-example: the team can still read a trail that has not expired.

    Scenario: A person cannot read their own trail
      Given Alice's trail was recorded 1 days ago
      When Alice looks for Alice's trail
      Then Alice cannot read that trail because people never see a trail

    Scenario: A person cannot read someone else's trail
      Given Bob's trail was recorded 1 days ago
      When Alice looks for Bob's trail
      Then Alice cannot read that trail because people never see a trail
