@domain:developer-tools
Feature: Keep and restore checkpoints
  When the team needs to revisit an investigation, the team wants to keep
  a checkpoint, so the same test world can be used again later.

  Rule: A compatible checkpoint restores its saved test world

    Scenario: Restoring returns the people to their saved apps
      Given the team has saved checkpoint "Before the invitation" with Alice and Bob
      And Alice's test world has changed since that checkpoint
      When the team restores checkpoint "Before the invitation"
      Then Alice and Bob see the apps saved in checkpoint "Before the invitation"

    Scenario: An incompatible checkpoint cannot be restored
      Given checkpoint "Before the invitation" cannot be used by this version of the app
      When the team selects checkpoint "Before the invitation"
      Then the team is not offered restoring because the checkpoint is incompatible

  Rule: Saving makes the current test world available as a checkpoint
    No counter-example: a successful save always lists its checkpoint; a failed save is not a checkpoint.

    Scenario: A saved checkpoint appears among the team's choices
      Given the team is investigating a test world with Alice and Bob
      When the team saves checkpoint "Before the invitation"
      Then the team can select checkpoint "Before the invitation"

  Rule: Deleting checkpoints requires confirmation

    Scenario: Confirmation removes the selected checkpoint
      Given the team has selected checkpoint "Before the invitation" for deletion
      When the team confirms deleting the selected checkpoints
      Then the team cannot select checkpoint "Before the invitation" because it was deleted

    Scenario: Cancelling keeps the selected checkpoint
      Given the team has selected checkpoint "Before the invitation" for deletion
      When the team cancels deleting the selected checkpoints
      Then the team can select checkpoint "Before the invitation"

  Rule: Removing incompatible checkpoints keeps compatible checkpoints

    Scenario: Incompatible checkpoints disappear together
      Given checkpoint "Before the invitation" cannot be used by this version of the app
      When the team confirms removing incompatible checkpoints
      Then the team cannot select checkpoint "Before the invitation" because it was removed

    Scenario: A compatible checkpoint remains available
      Given checkpoint "After accepting" can be used by this version of the app
      When the team confirms removing incompatible checkpoints
      Then the team can select checkpoint "After accepting"
