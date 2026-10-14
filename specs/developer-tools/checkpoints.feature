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

    Scenario: An interrupted save is not a checkpoint
      Given the team is investigating a test world with Alice and Bob
      When saving checkpoint "Before the invitation" is interrupted
      Then the team cannot select checkpoint "Before the invitation" because it was not saved

  Rule: A failed restore keeps the team on the world they already had
    No counter-example: a restore that succeeds returns the saved world, which is the earlier rule.

    Scenario: A failed restore keeps the apps the team was already looking at
      Given the team has saved checkpoint "Before the invitation" with Alice and Bob
      And Alice's test world has changed since that checkpoint
      When restoring checkpoint "Before the invitation" fails
      Then the team is told the restore failed
      And Alice and Bob are still on the apps they had before the restore

  Rule: Closing and opening the testing tool returns the world it kept, and a deleted checkpoint stays gone

    Scenario: The testing tool opens again on the world it kept
      Given the team is investigating a test world with Alice and Bob
      And the investigated app has changed
      When the testing tool closes and opens again
      Then Alice and Bob see the apps the testing tool kept

    Scenario: Opening the testing tool again does not bring back a deleted checkpoint
      Given the team has deleted checkpoint "Before the invitation"
      When the testing tool closes and opens again
      Then the team cannot select checkpoint "Before the invitation" because it was deleted

  Rule: Restoring one checkpoint keeps every other checkpoint's saved world alone

    Scenario: Restoring an earlier checkpoint shows that saved world
      Given the team has saved checkpoint "Before the invitation" with Alice and Bob
      And Alice's test world has changed since that checkpoint
      And the team has saved checkpoint "After the invitation"
      When the team restores checkpoint "Before the invitation"
      Then Alice and Bob see the apps saved in checkpoint "Before the invitation"

    Scenario: Restoring the later checkpoint shows that saved world
      Given the team has saved checkpoint "Before the invitation" with Alice and Bob
      And Alice's test world has changed since that checkpoint
      And the team has saved checkpoint "After the invitation"
      And the team has restored checkpoint "Before the invitation"
      When the team restores checkpoint "After the invitation"
      Then Alice and Bob see the apps saved in checkpoint "After the invitation"

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
