@domain:profile
Feature: Permanently delete an account
  When a person stops using the product, they want to delete their account
  with clear consequences, so their personal data and future account use end.

  Rule: Deletion requires a recently proven account and an explicit confirmation

    Scenario: Confirming deletion withdraws the account from use
      Given Alice has a recently proven account
      And Alice has reviewed the consequences of account deletion
      When Alice confirms account deletion
      Then Alice is signed out
      And Alice's account deletion is acknowledged with its completion deadline

    Scenario: Cancelling confirmation keeps the account
      Given Alice has reviewed the consequences of account deletion
      When Alice cancels account deletion
      Then Alice still has the same account because deletion was not confirmed

    Scenario: Old proof requires signing in again
      Given Alice completed signing in more than 10 minutes ago
      When Alice confirms account deletion
      Then Alice is told to prove the account again before deletion
      And Alice is told export and deletion need a sign-in from the last 10 minutes
      And Alice still has the same account

    @regression:deletion-permission-notice-hidden-by-dialog
    Scenario: Proof that runs out during confirmation is explained where Alice can see it
      Given Alice has reviewed the consequences of account deletion
      And Alice has kept the deletion confirmation open for 10 minutes
      When Alice confirms account deletion
      Then Alice is told to prove the account again before deletion
      And Alice still has the same account

    Scenario: Proof exactly ten minutes old requires signing in again
      Given Alice completed signing in exactly 10 minutes ago
      When Alice confirms account deletion
      Then Alice is told to prove the account again before deletion
      And Alice still has the same account

    Scenario: A guest cannot delete an account they do not have
      Given Alice is a guest
      When Alice asks for account deletion
      Then Alice is asked to sign in because deletion needs an account

    Scenario: An offline confirmation never queues a deletion for later
      Given Alice has a recently proven account
      And Alice is offline
      When Alice confirms account deletion
      Then Alice is told account deletion needs a connection
      And Alice still has the same account

  Rule: A deleted account cannot be used on another device or recovered by signing in

    Scenario: An online second device loses access to the deleted account
      Given Alice has a recently proven account
      And Alice is also signed in on another device
      When Alice confirms account deletion
      Then Alice's other device is signed out within 150 seconds
      And Alice's other device cannot make changes as the deleted account

    Scenario: An offline device loses deleted access when it returns
      Given Alice's account deletion has been confirmed on another device
      And Alice's phone is offline
      When Alice's phone comes back online
      Then Alice's phone is signed out
      And Alice's phone cannot restore the deleted account's personal data

    Scenario: Signing in after deletion starts afresh
      Given Alice's account deletion has completed
      When Alice signs in with Google
      Then Alice has a new account
      And Alice's deleted personal data cannot be recovered by that sign-in

  Rule: Confirmation explains what ends and what may be retained
    No counter-example: the same consequences must be shown before every account deletion confirmation.

    Scenario: The person can make an informed deletion choice
      Given Alice is signed in
      When Alice reviews account deletion
      Then Alice sees that account deletion is permanent and signs out every device
      And Alice sees the personal-data export choice and the retention exceptions
      And Alice sees that hosted spaces and future membership charges will end
      And Alice sees that Plus ends at once without refunding the remaining paid time or Plus credit

    @regression:deletion-omits-plus-loss
    Scenario: The final confirmation repeats what a Plus member loses
      Given Alice has a recently proven account
      When Alice asks for account deletion
      Then Alice is asked to confirm that Plus ends at once without refunding the remaining paid time or Plus credit

  Rule: Export and deletion can be found from account settings
    No counter-example: a guest has no account to delete, and a guest asking for deletion is the first rule's refusal.

    Scenario: Account settings lead a signed-in person to export and deletion
      Given Alice is signed in
      When Alice opens account settings
      Then Alice is offered personal-data export and account deletion there
