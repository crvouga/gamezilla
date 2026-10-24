@domain:billing
Feature: Stop charging a deleted account
  When a person deletes their account, they want future membership charges
  to stop, so giving up the account does not keep a recurring payment running.

  Rule: Confirmed account deletion stops future charges and paid access

    Scenario: Deletion cancels future membership charges
      Given Alice has subscribed to Plus
      And Alice has a recently proven account
      When Alice confirms account deletion
      Then Alice's membership cannot renew because the account was deleted
      And Alice no longer has paid access

    Scenario: An unfinished cancellation cannot be called complete
      Given Alice's account deletion has been confirmed
      And the payment provider has not yet confirmed cancellation
      When Alice views the account deletion outcome
      Then Alice is told cancellation is still being completed
      And Alice is not told the membership cancellation has completed

    Scenario: A charge after confirmed deletion is refunded
      Given Alice's account deletion has been confirmed
      When Alice's payment provider takes another membership payment
      Then that payment is refunded in full because account deletion had already been confirmed

  Rule: Retained payment records do not preserve the deleted account

    Scenario: Minimum payment evidence remains available for accounting
      Given Alice's account deletion has completed
      And Alice made a membership payment less than 7 years ago
      When the team reviews that payment record for accounting
      Then the team can see its minimum payment evidence

    Scenario: A payment record cannot restore paid access
      Given Alice's account deletion has completed
      And Alice's payment record is still retained for accounting
      When Alice signs in with Google
      Then Alice has free access
      And Alice's payment record cannot restore the deleted account's membership

    @regression:payment-retention-fixture-renewals
    Scenario: Ordinary payment retention expires after seven years
      Given Alice's payment record is 7 years old
      And no specific legal preservation obligation applies to it
      When the team reviews payment records due for erasure
      Then that payment record cannot remain because its retention period has expired
