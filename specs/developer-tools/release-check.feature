@domain:developer-tools
Feature: Decide whether an edition is ready for release
  When the team prepares an edition of the app, the team wants a release
  check backed by complete automated evidence, so people receive only an edition that meets its obligations.

  Rule: Every required obligation needs a current automated pass

    Scenario: Complete passing evidence permits a passing release check
      Given every required obligation has a current automated pass for this version of the app
      When the team runs the release check for this version of the app
      Then the release check passes for this version of the app

    Scenario: A failed obligation fails the release check
      Given a required obligation has failed for this version of the app
      When the team runs the release check for this version of the app
      Then the release check fails because a required obligation failed

    Scenario Outline: Unproven obligations cannot approve a release
      Given a required obligation's evidence for this version of the app is <evidence>
      When the team runs the release check for this version of the app
      Then the release check fails because the obligation lacks a current automated pass

      Examples:
        | evidence |
        | unknown |
        | missing |
        | skipped |
        | not run |
        | stale |
        | manual |

  Rule: Evidence belongs to the edition it checks

    Scenario: A passing edition is identified in its verdict
      Given every required obligation has a current automated pass for this version of the app
      When the team runs the release check for this version of the app
      Then the release check passes for this version of the app
      And the release check identifies the version of the app it approved

    Scenario: A previous edition's pass cannot approve a changed edition
      Given an earlier version of the app has a passing release check
      And the current version of the app has no automated evidence
      When the team runs the release check for the current version of the app
      Then the release check fails because the evidence belongs to an earlier version
