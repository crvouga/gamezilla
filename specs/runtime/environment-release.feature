@domain:runtime
Feature: Preparing and releasing an environment
  When the team prepares an environment or puts out a new edition, the team
  wants a failed release check to stop the release, a newer check of the same
  change to replace one still running, and a release already started to keep
  going, so people only receive an edition that passed.

  Rule: A failed preparation still lets the team open the environment
    No counter-example: preparation that finishes also lets the team open the environment.

    Scenario: A failed preparation tells the team and still opens the environment
      Given preparation of the environment cannot finish
      When the team prepares that environment
      Then the team is told preparation could not finish
      And the team can still open the environment

  Rule: A release finishes only after a passing release check

    Scenario: A passing release check lets the team put out the edition
      Given the release check passed for this version of the app
      When the team puts out this version of the app
      Then the release is finished

    Scenario: A failed release check does not put out the edition
      Given the release check failed for this version of the app
      When the team puts out this version of the app
      Then the release is not finished because the release check failed

  Rule: A newer release check of the same change replaces one still running
    No counter-example: one release does not replace another release's check.

    Scenario: A newer release check replaces the one still running
      Given a release check of a change is still running
      When the team starts a newer release check of that same change
      Then the earlier release check is no longer running

    Scenario: One release does not replace another release's check
      Given a release check for a release is still running
      When the team starts another release
      Then the earlier release's check is still running

  Rule: A release that has started is not undone
    No counter-example: a release that has not started changes nothing.

    Scenario: Starting another release keeps the unfinished one going
      Given a release is unfinished
      When the team starts another release
      Then the unfinished release is still unfinished

    Scenario: Stopping a release that has started does not undo it
      Given a release has started
      When the team stops that release
      Then that unfinished release is not undone
